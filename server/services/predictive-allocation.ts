import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  demandFeatureSnapshots,
  predictiveModelRuns,
  predictiveRecommendations,
  requestFeatureSnapshots,
  rescueRequests,
  resources,
  warehouses,
} from "../db/schema";
import { alertLevelScore, buildStatsKey, inferResourceType, normalizeRegion } from "./predictive-utils";
import {
  computeRequestSignals,
  buildWarehouseInventoryMap,
  type WarehouseSnapshot,
  type ResourceCandidate,
  type RequestSignalMetrics,
} from "./prioritization";
import { recordSchedulerRun } from "./scheduler-metrics";

const PREDICTIVE_REFRESH_INTERVAL_MS = Number(process.env.PREDICTIVE_REFRESH_INTERVAL_MS ?? 5 * 60 * 1000);
let predictiveTimer: NodeJS.Timeout | null = null;
let isRunningCycle = false;

const ACTIVE_STATUSES = ["pending", "in_progress"] as const;
const OPEN_RECOMMENDATION_STATUSES = ["suggested", "queued"] as const;
const DEMAND_LOOKBACK_MS = Number(process.env.PREDICTIVE_DEMAND_LOOKBACK_MS ?? 6 * 60 * 60 * 1000); // 6h default

export function startPredictiveAllocationScheduler() {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.DISABLE_PREDICTIVE_SCHEDULER === "true") return;
  if (predictiveTimer) return;

  predictiveTimer = setInterval(() => {
    void runPredictiveAllocationCycle();
  }, PREDICTIVE_REFRESH_INTERVAL_MS);

  // Kick off immediately on boot so operators see seed data.
  void runPredictiveAllocationCycle();
}

export async function runPredictiveAllocationCycle(now = new Date()) {
  if (isRunningCycle) return;
  isRunningCycle = true;
  const startedAt = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  try {
    const db = getDb();
    const openRequests = await db
      .select()
      .from(rescueRequests)
      .where(inArray(rescueRequests.status, ACTIVE_STATUSES))
      .orderBy(desc(rescueRequests.criticalityScore), desc(rescueRequests.createdAt))
      .limit(5);

    if (!openRequests.length) {
      success = true;
      return;
    }

    const resourceRows = await db
      .select({
        resource: resources,
        warehouseName: warehouses.name,
      })
      .from(resources)
      .leftJoin(warehouses, eq(resources.warehouseId, warehouses.id));

    const resourcePool: ResourceCandidate[] = resourceRows.map((row) => ({
      ...row.resource,
      warehouseName: row.warehouseName,
    }));

    const warehouseRows = await db.select().from(warehouses);
    const warehouseSnapshots: WarehouseSnapshot[] = warehouseRows.map((wh) => ({
      id: wh.id,
      name: wh.name,
      latitude: wh.latitude,
      longitude: wh.longitude,
      capacity: wh.capacity,
    }));

    const warehouseInventory = buildWarehouseInventoryMap(resourcePool);

    const nowMs = now.getTime();
    const regionStats = await loadRegionDemandStats(db, openRequests, now);

    const [modelRun] = await db
      .insert(predictiveModelRuns)
      .values({
        modelName: "baseline-heuristic",
        version: "0.1.0",
        runType: "inference",
        status: "completed",
        metricsJson: JSON.stringify({ driver: "stub" }),
        startedAt: nowMs,
        completedAt: nowMs,
      })
      .returning();

    for (const request of openRequests) {
      const existing = await db
        .select({ id: predictiveRecommendations.id })
        .from(predictiveRecommendations)
        .where(
          and(
            eq(predictiveRecommendations.requestId, request.id),
            inArray(predictiveRecommendations.status, OPEN_RECOMMENDATION_STATUSES),
          ),
        )
        .limit(1);

      if (existing.length) continue;

      const regionKey = normalizeRegion(request.location);
      const resourceType = inferResourceType(request.details ?? "").toLowerCase();
      const statsKey = buildStatsKey(regionKey, resourceType);
      const stats = regionStats.get(statsKey) ?? regionStats.get(buildStatsKey(regionKey, "general supplies"));
      const signals = computeRequestSignals(request, warehouseSnapshots, warehouseInventory, now);
      const nearestWarehouse = signals.nearestWarehouseId
        ? warehouseSnapshots.find((wh) => wh.id === signals.nearestWarehouseId)
        : undefined;
      const featureVector = buildFeatureVector(request, stats, signals);
      const recommendation = buildRecommendation(
        request,
        resourceType,
        stats,
        nowMs,
        signals,
        nearestWarehouse,
      );
      const travelTimeMinutes = featureVector.estimatedTravelMinutes ?? null;

      const [feature] = await db
        .insert(requestFeatureSnapshots)
        .values({
          requestId: request.id,
          snapshotAt: nowMs,
          peopleCount: request.peopleCount,
          priority: request.priority,
          severityScore: request.criticalityScore,
          weatherLayer: featureVector.weatherLayer,
          travelTimeMinutes,
          supplyPressure: featureVector.supplyPressure,
          modelFeatures: JSON.stringify(featureVector),
        })
        .returning();
      await db.insert(predictiveRecommendations).values({
        requestId: request.id,
        region: regionKey,
        resourceType: recommendation.resourceType,
        suggestedQuantity: recommendation.quantity,
        confidence: recommendation.confidence,
        impactScore: recommendation.impactScore,
        leadTimeMinutes: recommendation.leadTimeMinutes,
        status: "suggested",
        rationale: recommendation.rationale,
        modelRunId: modelRun?.id ?? null,
        featureSnapshotId: feature?.id ?? null,
        validFrom: nowMs,
        validUntil: nowMs + 2 * 60 * 60 * 1000,
      });
    }
    success = true;
  } catch (error) {
    console.error("predictive allocation cycle failed", error);
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    const finishedAt = Date.now();
    await recordSchedulerRun({
      name: "predictive_allocation",
      startedAt,
      finishedAt,
      success,
      errorMessage,
    });
    isRunningCycle = false;
  }
}

type RegionDemandStats = {
  region: string;
  resourceType: string;
  sampleCount: number;
  avgRequestCount: number;
  avgPending: number;
  avgPeople: number;
  avgSeverity: number;
  avgInventory: number | null;
  avgPrecipitation: number | null;
  avgWindKph: number | null;
  avgHumidity: number | null;
  weatherAlertLevel: string | null;
  weatherScore: number;
};

async function loadRegionDemandStats(db: ReturnType<typeof getDb>, requests: typeof rescueRequests.$inferSelect[], now: Date) {
  const regions = new Set<string>();
  for (const req of requests) {
    const regionKey = normalizeRegion(req.location);
    if (regionKey) regions.add(regionKey);
  }

  if (!regions.size) return new Map<string, RegionDemandStats>();

  const sinceMs = now.getTime() - DEMAND_LOOKBACK_MS;
  const rows = await db
    .select()
    .from(demandFeatureSnapshots)
    .where(
      and(
        inArray(demandFeatureSnapshots.region, Array.from(regions)),
        gte(demandFeatureSnapshots.bucketEnd, sinceMs),
      ),
    );

  const accumulator = new Map<
    string,
    {
      region: string;
      resourceType: string;
      sampleCount: number;
      requestSum: number;
      pendingSum: number;
      peopleSum: number;
      severitySum: number;
      inventorySum: number;
      precipSum: number;
      windSum: number;
      humiditySum: number;
      weatherAlertLevel: string | null;
      latestBucket: number;
    }
  >();

  for (const row of rows) {
    const regionKey = normalizeRegion(row.region);
    const resourceType = (row.resourceType ?? "general supplies").toLowerCase();
    const key = buildStatsKey(regionKey, resourceType);
    const current = accumulator.get(key) ?? {
      region: regionKey,
      resourceType,
      sampleCount: 0,
      requestSum: 0,
      pendingSum: 0,
      peopleSum: 0,
      severitySum: 0,
      inventorySum: 0,
      precipSum: 0,
      windSum: 0,
      humiditySum: 0,
      weatherAlertLevel: null,
      latestBucket: 0,
    };

    current.sampleCount += 1;
    current.requestSum += row.requestCount ?? 0;
    current.pendingSum += row.pendingCount ?? 0;
    current.peopleSum += row.avgPeople ?? 0;
    current.severitySum += row.avgSeverityScore ?? 0;
    current.inventorySum += row.inventoryAvailable ?? 0;
    current.precipSum += row.precipitationMm ?? 0;
    current.windSum += row.windSpeedKph ?? 0;
    current.humiditySum += row.humidity ?? 0;
    const bucketEndMs = typeof row.bucketEnd === "number" ? row.bucketEnd : 0;
    if (bucketEndMs >= current.latestBucket) {
      current.weatherAlertLevel = row.weatherAlertLevel ?? current.weatherAlertLevel;
      current.latestBucket = bucketEndMs;
    }
    accumulator.set(key, current);
  }

  const result = new Map<string, RegionDemandStats>();
  for (const [key, value] of accumulator.entries()) {
    const divisor = Math.max(1, value.sampleCount);
    result.set(key, {
      region: value.region,
      resourceType: value.resourceType,
      sampleCount: value.sampleCount,
      avgRequestCount: value.requestSum / divisor,
      avgPending: value.pendingSum / divisor,
      avgPeople: value.peopleSum / divisor,
      avgSeverity: value.severitySum / divisor,
      avgInventory: value.inventorySum / divisor,
      avgPrecipitation: value.precipSum / divisor,
      avgWindKph: value.windSum / divisor,
      avgHumidity: value.humiditySum / divisor,
      weatherAlertLevel: value.weatherAlertLevel,
      weatherScore: alertLevelScore(value.weatherAlertLevel),
    });
  }

  return result;
}

function buildFeatureVector(
  request: typeof rescueRequests.$inferSelect,
  stats: RegionDemandStats | undefined,
  signals: RequestSignalMetrics,
) {
  const inventoryBaseline = stats?.avgInventory ?? stats?.avgPending ?? 1;
  const demandPressure = stats ? (stats.avgPending + stats.avgRequestCount) / Math.max(1, inventoryBaseline) : 0.4;
  const travelMinutes =
    signals.nearestWarehouseDistanceKm != null
      ? Math.round((signals.nearestWarehouseDistanceKm / 40) * 60)
      : null;
  return {
    heuristic: true,
    region: normalizeRegion(request.location),
    resourceType: inferResourceType(request.details ?? ""),
    criticalityScore: request.criticalityScore,
    avgPending: stats?.avgPending ?? null,
    avgRequestCount: stats?.avgRequestCount ?? null,
    avgInventory: stats?.avgInventory ?? null,
    avgSeverity: stats?.avgSeverity ?? null,
    demandPressure,
    weatherLayer: stats?.weatherAlertLevel ?? null,
    weatherScore: stats?.weatherScore ?? 0,
    sampleCount: stats?.sampleCount ?? 0,
    supplyPressure: stats?.avgInventory ? stats.avgPending / Math.max(1, stats.avgInventory) : demandPressure,
    timeDecayWeight: signals.timeDecayWeight,
    proximityWeight: signals.proximityWeight,
    hubCapacityWeight: signals.hubCapacityWeight,
    nearestWarehouseId: signals.nearestWarehouseId,
    nearestWarehouseDistanceKm: signals.nearestWarehouseDistanceKm,
    hubCapacityRatio: signals.hubCapacityRatio,
    estimatedTravelMinutes: travelMinutes,
  };
}

function buildRecommendation(
  request: typeof rescueRequests.$inferSelect,
  resourceType: string,
  stats: RegionDemandStats | undefined,
  nowMs: number,
  signals: RequestSignalMetrics,
  nearestWarehouse?: WarehouseSnapshot,
) {
  const peopleFactor = Math.max(1, request.peopleCount ?? stats?.avgPeople ?? 1);
  const baseQty = peopleFactor * 3;
  const inventoryBaseline = stats?.avgInventory ?? stats?.avgPending ?? 1;
  const demandPressure = stats ? (stats.avgPending + stats.avgRequestCount) / Math.max(1, inventoryBaseline) : 0.4;
  const severityFactor = request.criticalityScore / 100;
  const weatherFactor = stats?.weatherScore ?? 0;
  const createdAtValue = request.createdAt;
  const createdAtMs =
    typeof createdAtValue === "number"
      ? createdAtValue
      : createdAtValue
        ? new Date(createdAtValue).getTime()
        : nowMs;
  const ageHours = Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60));
  const urgencyBoost = signals.timeDecayWeight / 45 + Math.min(0.25, ageHours / 72);
  const proximityFactor =
    signals.nearestWarehouseDistanceKm != null
      ? clamp(1.35 - Math.min(1, signals.nearestWarehouseDistanceKm / 250), 0.85, 1.35)
      : 1.1;
  const hubStress = signals.hubCapacityRatio != null ? Math.max(0, 0.8 - signals.hubCapacityRatio) : 0.1;
  const hubCapacityFactor = 1 + Math.min(0.35, hubStress * 0.6);
  const quantity = Math.round(
    Math.max(
      8,
      baseQty *
        (1 + demandPressure * 0.3 + severityFactor * 0.2 + weatherFactor + urgencyBoost) *
        proximityFactor *
        hubCapacityFactor,
    ),
  );
  const confidenceBase = 0.5 + Math.min(0.25, demandPressure * 0.2 + weatherFactor * 0.3);
  const proximityConfidence =
    signals.nearestWarehouseDistanceKm != null
      ? Math.max(-0.12, 0.12 - signals.nearestWarehouseDistanceKm / 400)
      : 0.06;
  const hubConfidence = signals.hubCapacityRatio != null ? Math.min(0.12, signals.hubCapacityRatio * 0.12) : -0.02;
  const confidence = clamp(
    confidenceBase + Math.min(0.12, (stats?.sampleCount ?? 0) * 0.012) + proximityConfidence + hubConfidence,
    0.45,
    0.96,
  );
  const impactScore = Math.round(
    request.criticalityScore * (1 + demandPressure * 0.15 + weatherFactor * 0.2 + urgencyBoost + hubStress * 0.1),
  );
  const distanceKm = signals.nearestWarehouseDistanceKm;
  const leadTimeMinutes = Math.round(
    Math.min(
      6 * 60,
      ((distanceKm ?? 35) / 45) * 60 + (signals.hubCapacityRatio != null && signals.hubCapacityRatio < 0.6 ? 45 : 20),
    ),
  );
  const rationaleParts = [
    stats?.avgPending != null ? `${stats.avgPending.toFixed(1)} avg pending` : null,
    stats?.avgInventory != null ? `${Math.round(stats.avgInventory)} inventory` : null,
    stats?.weatherAlertLevel ? `${stats.weatherAlertLevel} weather alert` : null,
    distanceKm != null
      ? `${Math.round(distanceKm)}km from ${nearestWarehouse?.name ?? "nearest hub"}`
      : null,
    signals.hubCapacityRatio != null ? `hub at ${(signals.hubCapacityRatio * 100).toFixed(0)}% capacity` : null,
  ].filter(Boolean);

  return {
    resourceType,
    quantity,
    confidence,
    impactScore,
    leadTimeMinutes,
    rationale:
      rationaleParts.length > 0
        ? `Regional trends: ${rationaleParts.join(", ")}.`
        : `Heuristic demand estimate for ${normalizeRegion(request.location)}.`,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
