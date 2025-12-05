import { rescueRequests, resources, warehouses } from "../db/schema";

export type RescueRequestRecord = typeof rescueRequests.$inferSelect;
export type ResourceRecord = typeof resources.$inferSelect;
export type WarehouseRecord = typeof warehouses.$inferSelect;

export type ResourceCandidate = ResourceRecord & {
  warehouseName?: string | null;
};

export type WarehouseSnapshot = Pick<
  WarehouseRecord,
  "id" | "name" | "latitude" | "longitude" | "capacity"
>;

export type WarehouseInventoryMap = Map<number, number>;

export type RequestSignalMetrics = {
  timeDecayWeight: number;
  proximityWeight: number;
  hubCapacityWeight: number;
  nearestWarehouseId: number | null;
  nearestWarehouseDistanceKm: number | null;
  hubCapacityRatio: number | null;
};

export type PriorityEvaluation = {
  score: number;
  severityWeight: number;
  peopleWeight: number;
  ageWeight: number;
  supplyPressureWeight: number;
  proximityWeight: number;
  hubCapacityWeight: number;
  nearestWarehouseId: number | null;
  nearestWarehouseDistanceKm: number | null;
  hubCapacityRatio: number | null;
  recommendedResource?: {
    resourceId: number;
    warehouseId: number;
    quantity: number;
    rationale: string;
  } | null;
  rationale: string;
};

export type PriorityContext = {
  totalResourceQuantity: number;
  pendingRequests: number;
  warehouses: WarehouseSnapshot[];
  warehouseInventory: WarehouseInventoryMap;
};

const KEYWORD_MAP: Record<string, string[]> = {
  water: ["water", "hydration", "drinking"],
  food: ["food", "meal", "ration"],
  "medical kits": ["medical", "injury", "first aid", "medicine"],
  blankets: ["blanket", "shelter", "cold"],
  fuel: ["fuel", "diesel", "gasoline"],
  "baby formula": ["baby", "infant"],
  tarpaulins: ["tarp", "cover", "roof"],
};

const DEFAULT_RESOURCE_ORDER = [
  "medical kits",
  "water",
  "food",
  "blankets",
  "fuel",
  "tarpaulins",
];

export function evaluateRequestPriority(
  request: RescueRequestRecord,
  resourcePool: ResourceCandidate[],
  context: PriorityContext,
  now = new Date(),
): PriorityEvaluation {
  const severityWeight = getSeverityWeight(request.priority);
  const peopleWeight = getPeopleWeight(request.peopleCount);
  const supplyPressureWeight = getSupplyPressureWeight(context);
  const signals = computeRequestSignals(request, context.warehouses, context.warehouseInventory, now);
  const score =
    severityWeight +
    peopleWeight +
    supplyPressureWeight +
    signals.timeDecayWeight +
    signals.proximityWeight +
    signals.hubCapacityWeight;

  const recommendation = buildRecommendation(request, resourcePool);

  const rationaleParts = [
    `Severity=${severityWeight}`,
    `People=${peopleWeight}`,
    `TimeDecay=${signals.timeDecayWeight}`,
    `Supply=${supplyPressureWeight}`,
    `Proximity=${signals.proximityWeight}`,
    `HubCap=${signals.hubCapacityWeight}`,
  ];
  if (recommendation?.rationale) rationaleParts.push(recommendation.rationale);

  return {
    score,
    severityWeight,
    peopleWeight,
    ageWeight: signals.timeDecayWeight,
    supplyPressureWeight,
    proximityWeight: signals.proximityWeight,
    hubCapacityWeight: signals.hubCapacityWeight,
    nearestWarehouseId: signals.nearestWarehouseId,
    nearestWarehouseDistanceKm: signals.nearestWarehouseDistanceKm,
    hubCapacityRatio: signals.hubCapacityRatio,
    recommendedResource: recommendation
      ? {
          resourceId: recommendation.resourceId,
          warehouseId: recommendation.warehouseId,
          quantity: recommendation.quantity,
          rationale: recommendation.rationale,
        }
      : null,
    rationale: rationaleParts.join(" | "),
  };
}

export function computeRequestSignals(
  request: RescueRequestRecord,
  warehouses: WarehouseSnapshot[],
  warehouseInventory: WarehouseInventoryMap,
  now = new Date(),
): RequestSignalMetrics {
  const timeDecayWeight = getTimeDecayWeight(request.createdAt, now);
  const nearest = findNearestWarehouse(request, warehouses);
  const proximityWeight = getProximityWeight(nearest?.distanceKm);
  const { hubCapacityWeight, hubCapacityRatio } = getHubCapacitySignal(nearest, warehouseInventory);

  return {
    timeDecayWeight,
    proximityWeight,
    hubCapacityWeight,
    nearestWarehouseId: nearest?.warehouse?.id ?? null,
    nearestWarehouseDistanceKm: nearest?.distanceKm ?? null,
    hubCapacityRatio,
  };
}

export function buildWarehouseInventoryMap(resources: ResourceCandidate[]): WarehouseInventoryMap {
  const inventory = new Map<number, number>();
  for (const entry of resources) {
    if (entry.warehouseId == null) continue;
    const current = inventory.get(entry.warehouseId) ?? 0;
    inventory.set(entry.warehouseId, current + (entry.quantity ?? 0));
  }
  return inventory;
}

function getSeverityWeight(priority: RescueRequestRecord["priority"]): number {
  switch (priority) {
    case "high":
      return 40;
    case "medium":
      return 25;
    default:
      return 10;
  }
}

function getPeopleWeight(peopleCount: number | null): number {
  const count = peopleCount ?? 1;
  return Math.min(30, Math.round(count * 1.5));
}

function getTimeDecayWeight(createdAt: number | Date, now: Date): number {
  const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : createdAt;
  const ageHours = Math.max(0, (now.getTime() - createdAtMs) / (1000 * 60 * 60));
  const decay = Math.exp(-ageHours / 12); // half-life ~12h to keep newer requests hot
  return Math.max(4, Math.min(20, Math.round(decay * 20)));
}

function getSupplyPressureWeight(context: PriorityContext): number {
  if (context.totalResourceQuantity <= 0) return 15;
  const demandRatio = context.pendingRequests / Math.max(1, context.totalResourceQuantity / 100);
  return Math.min(15, Math.round(demandRatio * 3));
}

function getProximityWeight(distanceKm?: number | null): number {
  if (distanceKm == null) return 6;
  return Math.min(20, Math.round(distanceKm * 0.6));
}

function getHubCapacitySignal(
  nearest: NearestWarehouse | null,
  warehouseInventory: WarehouseInventoryMap,
): { hubCapacityWeight: number; hubCapacityRatio: number | null } {
  if (!nearest?.warehouse?.id) {
    return { hubCapacityWeight: 8, hubCapacityRatio: null };
  }
  const stock = warehouseInventory.get(nearest.warehouse.id) ?? 0;
  const capacity = nearest.warehouse.capacity ?? null;
  if (!capacity || capacity <= 0) {
    return { hubCapacityWeight: 10, hubCapacityRatio: null };
  }
  const ratio = Math.min(2, stock / capacity);
  const shortage = Math.max(0, 0.7 - ratio);
  const weight = Math.round(shortage * 30);
  return { hubCapacityWeight: weight, hubCapacityRatio: ratio };
}

function buildRecommendation(request: RescueRequestRecord, resourcePool: ResourceCandidate[]) {
  if (!resourcePool.length) return null;
  const preferredTypes = inferResourceNeeds(request.details || "");
  const sortedPool = [...resourcePool].sort((a, b) => b.quantity - a.quantity);
  const candidate = preferredTypes
    .map((type) =>
      sortedPool.find((res) => res.type.toLowerCase() === type.toLowerCase() && res.quantity > 0),
    )
    .find(Boolean) as ResourceCandidate | undefined;

  const target = candidate ?? sortedPool[0];
  if (!target || target.quantity <= 0) return null;

  const baseline = Math.max(5, (request.peopleCount ?? 1) * 4);
  const quantity = Math.min(target.quantity, baseline);
  const rationale = `Recommend ${quantity} ${target.type} from warehouse ${target.warehouseName ?? `#${target.warehouseId}`}`;

  return {
    resourceId: target.id,
    warehouseId: target.warehouseId,
    quantity,
    rationale,
  };
}

function inferResourceNeeds(details: string): string[] {
  const lower = details.toLowerCase();
  const matches: string[] = [];
  for (const [resourceType, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      matches.push(resourceType);
    }
  }
  if (!matches.length) {
    matches.push(...DEFAULT_RESOURCE_ORDER);
  }
  return matches;
}

type NearestWarehouse = {
  warehouse: WarehouseSnapshot;
  distanceKm: number | null;
};

function findNearestWarehouse(
  request: RescueRequestRecord,
  warehousesList: WarehouseSnapshot[],
): NearestWarehouse | null {
  if (request.latitude == null || request.longitude == null) return null;
  let best: NearestWarehouse | null = null;
  for (const wh of warehousesList) {
    if (wh.latitude == null || wh.longitude == null) continue;
    const distanceKm = haversineDistance(request.latitude, request.longitude, wh.latitude, wh.longitude);
    if (!best || (distanceKm != null && distanceKm < (best.distanceKm ?? Infinity))) {
      best = { warehouse: wh, distanceKm };
    }
  }
  return best;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
