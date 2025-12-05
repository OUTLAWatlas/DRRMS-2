import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { generateDemandFeatureSnapshot } from "../services/demand-snapshot";
import { ingestProviderHealthTelemetry, isProviderHealthEnabled } from "../services/provider-health";
import { getDbAsync } from "./index";
import {
  demandFeatureSnapshots,
  governmentAlerts,
  liveWeatherReadings,
  rescueRequests,
  resources,
  transactions,
  users,
  warehouses,
} from "./schema";
import { encryptField } from "../security/encryption";
import { hashSensitiveValue } from "../security/hash";

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception during seeding:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection during seeding:", reason);
});

type SeedProfile = "dev" | "demo" | "prod";

type WarehouseSeed = {
  name: string;
  location: string;
  capacity: number;
  lastAuditedAt?: number;
  latitude: number;
  longitude: number;
};

type ResourceSeed = {
  warehouse: string;
  type: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
};

type RescueRequestSeed = {
  location: string;
  details: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "fulfilled" | "cancelled";
  peopleCount: number;
  latitude: number;
  longitude: number;
  createdMinutesAgo: number;
  updatedMinutesAgo?: number;
  criticalityScore: number;
};

type DemandSeedConfig = {
  bucketCount: number;
  bucketMinutes: number;
};

type TransactionSeed = {
  reference: string;
  direction: "income" | "expense";
  amount: number;
  currency?: string;
  category: string;
  description?: string;
  linkedRequestDetail?: string;
  offsetMinutes?: number;
};

type DemandRegionProfile = {
  region: string;
  weather: {
    alertLevel: string;
    precipitation: number;
    wind: number;
    humidity: number;
  };
  resources: Array<{
    type: string;
    baseRequest: number;
    variance: number;
    trend: number;
    pendingRatio: number;
    inProgressRatio: number;
    cancelledRatio: number;
    avgPeople: number;
    avgSeverity: number;
    waitMins: number;
    waitVariance: number;
    inventoryBase: number;
    inventoryDecay: number;
    openAllocationsBase: number;
    allocationTrend: number;
  }>;
};

const DEFAULT_PROFILE: SeedProfile = "dev";

const WAREHOUSE_SEED: WarehouseSeed[] = [
  {
    name: "Mumbai Central Warehouse",
    location: "Mumbai, India",
    capacity: 3500,
    lastAuditedAt: Date.parse("2025-10-05"),
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    name: "Pune Relief Depot",
    location: "Pune, India",
    capacity: 2400,
    lastAuditedAt: Date.parse("2025-09-22"),
    latitude: 18.5204,
    longitude: 73.8567,
  },
  {
    name: "Nagpur Forward Base",
    location: "Nagpur, India",
    capacity: 1500,
    lastAuditedAt: Date.parse("2025-09-30"),
    latitude: 21.1458,
    longitude: 79.0882,
  },
];

const RESOURCE_SEED: ResourceSeed[] = [
  { warehouse: "Mumbai Central Warehouse", type: "Water", quantity: 1800, unit: "liters", reorderLevel: 500 },
  { warehouse: "Mumbai Central Warehouse", type: "Food", quantity: 1200, unit: "packs", reorderLevel: 300 },
  { warehouse: "Mumbai Central Warehouse", type: "Medical Kits", quantity: 420, unit: "kits", reorderLevel: 120 },
  { warehouse: "Pune Relief Depot", type: "Blankets", quantity: 600, unit: "units", reorderLevel: 150 },
  { warehouse: "Pune Relief Depot", type: "Baby Formula", quantity: 320, unit: "tins", reorderLevel: 80 },
  { warehouse: "Nagpur Forward Base", type: "Fuel", quantity: 280, unit: "liters", reorderLevel: 100 },
  { warehouse: "Nagpur Forward Base", type: "Tarpaulins", quantity: 220, unit: "sheets", reorderLevel: 60 },
];

const BASE_RESCUE_REQUESTS: RescueRequestSeed[] = [
  {
    location: "Kurla, Mumbai",
    details: "[seed] Flooded chawl requesting potable water and tarps",
    priority: "high",
    status: "pending",
    peopleCount: 18,
    latitude: 19.0728,
    longitude: 72.8836,
    createdMinutesAgo: 45,
    updatedMinutesAgo: 20,
    criticalityScore: 82,
  },
  {
    location: "Andheri Transit Camp",
    details: "[seed] Apartment block needs emergency shoring kits",
    priority: "high",
    status: "pending",
    peopleCount: 22,
    latitude: 19.1197,
    longitude: 72.8468,
    createdMinutesAgo: 70,
    updatedMinutesAgo: 25,
    criticalityScore: 88,
  },
  {
    location: "Navi Mumbai Dockyards",
    details: "[seed] Chemical exposure team requesting medical kits",
    priority: "high",
    status: "in_progress",
    peopleCount: 14,
    latitude: 19.033,
    longitude: 73.0297,
    createdMinutesAgo: 110,
    updatedMinutesAgo: 50,
    criticalityScore: 84,
  },
  {
    location: "Vasai Creek",
    details: "[seed] Boats stranded, need fuel drums at creek jetty",
    priority: "medium",
    status: "in_progress",
    peopleCount: 9,
    latitude: 19.3462,
    longitude: 72.8087,
    createdMinutesAgo: 120,
    updatedMinutesAgo: 30,
    criticalityScore: 67,
  },
  {
    location: "Chiplun",
    details: "[seed] Landslide-prone hillside needs blankets & rations",
    priority: "medium",
    status: "pending",
    peopleCount: 25,
    latitude: 17.5334,
    longitude: 73.5175,
    createdMinutesAgo: 210,
    updatedMinutesAgo: 160,
    criticalityScore: 71,
  },
  {
    location: "Satara Plateau",
    details: "[seed] Scattered hamlets need dry rations and blankets",
    priority: "medium",
    status: "pending",
    peopleCount: 20,
    latitude: 17.6805,
    longitude: 73.9933,
    createdMinutesAgo: 260,
    updatedMinutesAgo: 200,
    criticalityScore: 66,
  },
  {
    location: "Solapur Ring Road",
    details: "[seed] Urban flood relief wants additional pumping sets",
    priority: "medium",
    status: "pending",
    peopleCount: 16,
    latitude: 17.6599,
    longitude: 75.9064,
    createdMinutesAgo: 180,
    updatedMinutesAgo: 120,
    criticalityScore: 63,
  },
  {
    location: "Amravati Township",
    details: "[seed] Relief camp short on hygiene kits",
    priority: "medium",
    status: "in_progress",
    peopleCount: 19,
    latitude: 20.9374,
    longitude: 77.7796,
    createdMinutesAgo: 95,
    updatedMinutesAgo: 40,
    criticalityScore: 68,
  },
  {
    location: "Aurangabad Relief Corridor",
    details: "[seed] ICU transfer requires generator fuel escort",
    priority: "high",
    status: "pending",
    peopleCount: 8,
    latitude: 19.8762,
    longitude: 75.3433,
    createdMinutesAgo: 155,
    updatedMinutesAgo: 60,
    criticalityScore: 86,
  },
  {
    location: "South Nagpur",
    details: "[seed] High-rise without power, elderly on oxygen",
    priority: "high",
    status: "fulfilled",
    peopleCount: 6,
    latitude: 21.1285,
    longitude: 79.0823,
    createdMinutesAgo: 360,
    updatedMinutesAgo: 40,
    criticalityScore: 64,
  },
  {
    location: "Mira Road East",
    details: "[seed] Basement flooding asks for portable sump pumps",
    priority: "low",
    status: "pending",
    peopleCount: 10,
    latitude: 19.2952,
    longitude: 72.8721,
    createdMinutesAgo: 140,
    updatedMinutesAgo: 90,
    criticalityScore: 48,
  },
  {
    location: "Panvel Node",
    details: "[seed] Peri-urban families need baby-care kits",
    priority: "low",
    status: "pending",
    peopleCount: 7,
    latitude: 18.9894,
    longitude: 73.1175,
    createdMinutesAgo: 210,
    updatedMinutesAgo: 150,
    criticalityScore: 45,
  },
  {
    location: "Kalyan Riverside",
    details: "[seed] Schools sheltering evacuees request mats",
    priority: "low",
    status: "in_progress",
    peopleCount: 28,
    latitude: 19.2403,
    longitude: 73.1305,
    createdMinutesAgo: 320,
    updatedMinutesAgo: 180,
    criticalityScore: 52,
  },
  {
    location: "Wardha Market",
    details: "[seed] Shop row clearing debris wants gloves and masks",
    priority: "low",
    status: "pending",
    peopleCount: 5,
    latitude: 20.7453,
    longitude: 78.6022,
    createdMinutesAgo: 75,
    updatedMinutesAgo: 35,
    criticalityScore: 44,
  },
  {
    location: "Kolhapur Taluka",
    details: "[seed] Gauging station crew seeks rope kits",
    priority: "low",
    status: "fulfilled",
    peopleCount: 4,
    latitude: 16.705,
    longitude: 74.2433,
    createdMinutesAgo: 460,
    updatedMinutesAgo: 50,
    criticalityScore: 41,
  },
];

const DEMO_EXTRA_RESCUE_REQUESTS: RescueRequestSeed[] = [
  {
    location: "Pimpri-Chinchwad",
    details: "[seed] Substation flooded, back-up batteries requested",
    priority: "high",
    status: "pending",
    peopleCount: 12,
    latitude: 18.627,
    longitude: 73.8037,
    createdMinutesAgo: 90,
    updatedMinutesAgo: 60,
    criticalityScore: 77,
  },
  {
    location: "Thane Industrial Belt",
    details: "[seed] Chemical unit fire watch requesting medical kits",
    priority: "high",
    status: "in_progress",
    peopleCount: 14,
    latitude: 19.2183,
    longitude: 72.9781,
    createdMinutesAgo: 300,
    updatedMinutesAgo: 50,
    criticalityScore: 80,
  },
  {
    location: "Raigad Foothills",
    details: "[seed] Remote hamlets inaccessible, helicopter drop of food",
    priority: "medium",
    status: "pending",
    peopleCount: 30,
    latitude: 18.5,
    longitude: 73.2,
    createdMinutesAgo: 540,
    updatedMinutesAgo: 480,
    criticalityScore: 69,
  },
];

const RESCUE_REQUEST_PRESETS: Record<SeedProfile, RescueRequestSeed[]> = {
  dev: BASE_RESCUE_REQUESTS,
  demo: [...BASE_RESCUE_REQUESTS, ...DEMO_EXTRA_RESCUE_REQUESTS],
  prod: BASE_RESCUE_REQUESTS.slice(0, 2),
};

const DEMAND_SEED_PRESETS: Record<SeedProfile, DemandSeedConfig> = {
  dev: { bucketCount: 12, bucketMinutes: Number(process.env.DEMAND_SNAPSHOT_BUCKET_MINUTES ?? 30) },
  demo: { bucketCount: 24, bucketMinutes: Number(process.env.DEMAND_SNAPSHOT_BUCKET_MINUTES ?? 30) },
  prod: { bucketCount: 6, bucketMinutes: Number(process.env.DEMAND_SNAPSHOT_BUCKET_MINUTES ?? 30) },
};

const TRANSACTION_SEED: TransactionSeed[] = [
  {
    reference: "Fuel convoy - Vasai Creek",
    direction: "expense",
    amount: 48000,
    category: "fuel",
    description: "Diesel drums for stranded boats at Vasai",
    linkedRequestDetail: "[seed] Boats stranded, need fuel drums at creek jetty",
    offsetMinutes: 180,
  },
  {
    reference: "Logistics - Blanket restock",
    direction: "expense",
    amount: 22000,
    category: "logistics",
    description: "Hired trucks to push blankets towards Raigad",
    linkedRequestDetail: "[seed] Landslide-prone hillside needs blankets & rations",
    offsetMinutes: 320,
  },
  {
    reference: "Medical kits - Thane fire watch",
    direction: "expense",
    amount: 36000,
    category: "medical",
    description: "Rapid medical kit procurement for Thane industrial belt",
    linkedRequestDetail: "[seed] Chemical unit fire watch requesting medical kits",
    offsetMinutes: 95,
  },
  {
    reference: "Mahindra CSR tranche",
    direction: "income",
    amount: 150000,
    category: "grant",
    description: "Corporate CSR grant routed to DRRMS operations",
    offsetMinutes: 1440,
  },
  {
    reference: "Volunteer donation drive",
    direction: "income",
    amount: 48000,
    category: "donation",
    description: "Weekend donor collective for water and food kits",
    offsetMinutes: 720,
  },
  {
    reference: "Ops - Generator maintenance",
    direction: "expense",
    amount: 12500,
    category: "operations",
    description: "Routine maintenance for Pune depot generators",
    offsetMinutes: 260,
  },
];

const DEMAND_REGION_PROFILES: DemandRegionProfile[] = [
  {
    region: "mumbai",
    weather: { alertLevel: "watch", precipitation: 14, wind: 28, humidity: 78 },
    resources: [
      {
        type: "water",
        baseRequest: 24,
        variance: 6,
        trend: 0.8,
        pendingRatio: 0.35,
        inProgressRatio: 0.25,
        cancelledRatio: 0.05,
        avgPeople: 6.5,
        avgSeverity: 78,
        waitMins: 46,
        waitVariance: 12,
        inventoryBase: 1750,
        inventoryDecay: 18,
        openAllocationsBase: 4,
        allocationTrend: 0.3,
      },
      {
        type: "medical kits",
        baseRequest: 12,
        variance: 4,
        trend: 0.5,
        pendingRatio: 0.28,
        inProgressRatio: 0.22,
        cancelledRatio: 0.03,
        avgPeople: 4.1,
        avgSeverity: 74,
        waitMins: 38,
        waitVariance: 10,
        inventoryBase: 420,
        inventoryDecay: 4,
        openAllocationsBase: 2,
        allocationTrend: 0.15,
      },
    ],
  },
  {
    region: "pune",
    weather: { alertLevel: "normal", precipitation: 6, wind: 18, humidity: 65 },
    resources: [
      {
        type: "food",
        baseRequest: 16,
        variance: 5,
        trend: 0.3,
        pendingRatio: 0.32,
        inProgressRatio: 0.18,
        cancelledRatio: 0.04,
        avgPeople: 5.8,
        avgSeverity: 68,
        waitMins: 33,
        waitVariance: 8,
        inventoryBase: 1200,
        inventoryDecay: 10,
        openAllocationsBase: 3,
        allocationTrend: 0.1,
      },
      {
        type: "blankets",
        baseRequest: 8,
        variance: 3,
        trend: 0.2,
        pendingRatio: 0.25,
        inProgressRatio: 0.15,
        cancelledRatio: 0.02,
        avgPeople: 4.8,
        avgSeverity: 60,
        waitMins: 28,
        waitVariance: 6,
        inventoryBase: 600,
        inventoryDecay: 6,
        openAllocationsBase: 1,
        allocationTrend: 0.05,
      },
    ],
  },
  {
    region: "nagpur",
    weather: { alertLevel: "advisory", precipitation: 4, wind: 16, humidity: 58 },
    resources: [
      {
        type: "fuel",
        baseRequest: 6,
        variance: 2,
        trend: 0.15,
        pendingRatio: 0.3,
        inProgressRatio: 0.2,
        cancelledRatio: 0.04,
        avgPeople: 3.4,
        avgSeverity: 65,
        waitMins: 31,
        waitVariance: 5,
        inventoryBase: 280,
        inventoryDecay: 3,
        openAllocationsBase: 1,
        allocationTrend: 0.05,
      },
      {
        type: "tarpaulins",
        baseRequest: 7,
        variance: 2,
        trend: 0.1,
        pendingRatio: 0.26,
        inProgressRatio: 0.16,
        cancelledRatio: 0.03,
        avgPeople: 3.9,
        avgSeverity: 62,
        waitMins: 27,
        waitVariance: 5,
        inventoryBase: 220,
        inventoryDecay: 2,
        openAllocationsBase: 1,
        allocationTrend: 0.04,
      },
    ],
  },
];

const SAMPLE_WEATHER_POINTS = [
  { locationName: "Mumbai", latitude: 19.076, longitude: 72.8777 },
  { locationName: "Pune", latitude: 18.5204, longitude: 73.8567 },
  { locationName: "Nagpur", latitude: 21.1458, longitude: 79.0882 },
];

const SAMPLE_ALERT = {
  headline: "Test flood watch",
  area: "Konkan belt",
  severity: "Severe",
  certainty: "Likely",
  urgency: "Immediate",
  summary: "Seed alert indicating heavy rainfall for smoke tests.",
};

async function seedDatabase() {
  const profile = resolveProfile();
  console.log(`Starting database seed for profile='${profile}'...`);
  try {
    const db = await getDbAsync();
    const { rescuerId, adminId } = await ensureCoreUsers(db);
    const warehouseMap = await seedWarehouses(db, WAREHOUSE_SEED);
    await seedResources(db, warehouseMap, RESOURCE_SEED);
    await seedRescueRequests(db, rescuerId, RESCUE_REQUEST_PRESETS[profile]);
    await seedTransactions(db, adminId ?? rescuerId, TRANSACTION_SEED);
    await seedLiveFeeds(db);
    await seedDemandSnapshots(db, DEMAND_SEED_PRESETS[profile]);
    await seedProviderHealthTelemetry();
    console.log("Generating latest demand snapshot from live data...");
    await generateDemandFeatureSnapshot(new Date());
    console.log("Seeding completed.");
  } catch (err) {
    console.error("Seeding failed:", err);
    throw err;
  }
}

function resolveProfile(): SeedProfile {
  const argProfile = process.argv[2]?.toLowerCase();
  const envProfile = process.env.SEED_PROFILE?.toLowerCase();
  const candidate = (argProfile || envProfile || DEFAULT_PROFILE) as SeedProfile;
  if (!["dev", "demo", "prod"].includes(candidate)) {
    console.warn(`Unknown seed profile '${candidate}', defaulting to '${DEFAULT_PROFILE}'.`);
    return DEFAULT_PROFILE;
  }
  return candidate;
}

async function ensureCoreUsers(db: Awaited<ReturnType<typeof getDbAsync>>) {
  console.log("Ensuring core users exist...");
  const rescuerEmail = "rescuer@drrms.org";
  const adminEmail = "admin@drrms.org";

  let rescuerId: number;
  const existingRescuer = await db.select().from(users).where(eq(users.email, rescuerEmail));
  if (existingRescuer.length === 0) {
    const passwordHash = await bcrypt.hash("password123", 10);
    const [inserted] = await db
      .insert(users)
      .values({
        name: "Default Rescuer",
        email: rescuerEmail,
        passwordHash,
        role: "rescuer",
      })
      .returning();
    rescuerId = inserted.id as number;
    console.log(`Created rescuer user with id=${rescuerId}`);
  } else {
    rescuerId = existingRescuer[0].id as number;
    console.log(`Rescuer user already exists id=${rescuerId}`);
  }

  let adminId: number;
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash("adminSecure123", 10);
    const [adminUser] = await db
      .insert(users)
      .values({
        name: "Operations Admin",
        email: adminEmail,
        passwordHash,
        role: "admin",
      })
      .returning();
    adminId = adminUser.id as number;
    console.log(`Created admin user with id=${adminId}`);
  } else {
    adminId = existingAdmin[0].id as number;
    console.log(`Admin user already exists id=${adminId}`);
  }

  return { rescuerId, adminId };
}

async function seedWarehouses(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  warehousesSeed: WarehouseSeed[],
) {
  console.log("Upserting warehouses...");
  const map = new Map<string, number>();
  for (const wh of warehousesSeed) {
    const existing = await db.select().from(warehouses).where(eq(warehouses.name, wh.name));
    if (existing.length === 0) {
      const [created] = await db
        .insert(warehouses)
        .values({
          name: wh.name,
          location: wh.location,
          capacity: wh.capacity,
          lastAuditedAt: wh.lastAuditedAt ?? null,
          latitude: wh.latitude,
          longitude: wh.longitude,
        })
        .returning();
      map.set(wh.name, created.id as number);
      console.log(`Created warehouse '${wh.name}' (id=${created.id})`);
    } else {
      map.set(wh.name, existing[0].id as number);
      console.log(`Warehouse '${wh.name}' already exists (id=${existing[0].id})`);
    }
  }
  return map;
}

async function seedResources(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  warehouseMap: Map<string, number>,
  resourcesSeed: ResourceSeed[],
) {
  console.log("Upserting resources...");
  for (const resource of resourcesSeed) {
    const warehouseId = warehouseMap.get(resource.warehouse);
    if (!warehouseId) continue;
    const existing = await db
      .select()
      .from(resources)
      .where(and(eq(resources.warehouseId, warehouseId), eq(resources.type, resource.type)));
    if (existing.length > 0) {
      console.log(`Resource '${resource.type}' already exists in ${resource.warehouse}`);
      continue;
    }
    await db
      .insert(resources)
      .values({
        type: resource.type,
        quantity: resource.quantity,
        unit: resource.unit,
        reorderLevel: resource.reorderLevel,
        warehouseId,
      })
      .returning();
    console.log(`Created resource '${resource.type}' for ${resource.warehouse}`);
  }
}

async function seedRescueRequests(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  requesterId: number,
  seeds: RescueRequestSeed[],
) {
  if (!seeds.length) {
    console.log("Skipping rescue request seed for this profile.");
    return;
  }
  console.log(`Upserting ${seeds.length} rescue requests...`);
  const now = Date.now();
  for (const request of seeds) {
    const digest = hashSensitiveValue(request.details);
    const existing = await db
      .select({ id: rescueRequests.id })
      .from(rescueRequests)
      .where(eq(rescueRequests.detailsDigest, digest))
      .limit(1);
    if (existing.length > 0) {
      continue;
    }
    const createdAt = new Date(now - request.createdMinutesAgo * 60 * 1000);
    const updatedAtMinutes = request.updatedMinutesAgo ?? Math.max(request.createdMinutesAgo - 15, 5);
    const updatedAt = new Date(now - updatedAtMinutes * 60 * 1000);
    const createdAtMs = createdAt.getTime();
    const updatedAtMs = updatedAt.getTime();
    await db.insert(rescueRequests).values({
      userId: requesterId,
      location: request.location,
      details: encryptField(request.details)!,
      detailsDigest: digest,
      priority: request.priority,
      status: request.status,
      peopleCount: request.peopleCount,
      latitude: request.latitude,
      longitude: request.longitude,
      criticalityScore: request.criticalityScore,
      lastScoredAt: updatedAtMs,
      createdAt: createdAtMs,
      updatedAt: updatedAtMs,
    });
  }
}

async function seedTransactions(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  actorUserId: number | undefined,
  seeds: TransactionSeed[],
) {
  if (!actorUserId || seeds.length === 0) return;
  console.log("Upserting sample transactions...");
  const requestRows = await db
    .select({ id: rescueRequests.id, digest: rescueRequests.detailsDigest })
    .from(rescueRequests);
  const requestMap = new Map<string, number>();
  requestRows.forEach((row) => {
    if (row.digest) {
      requestMap.set(row.digest, row.id as number);
    }
  });

  for (const entry of seeds) {
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.reference, entry.reference))
      .limit(1);
    if (existing.length > 0) continue;

    const linkedRequestId = entry.linkedRequestDetail
      ? requestMap.get(hashSensitiveValue(entry.linkedRequestDetail)) ?? null
      : null;
    const recordedAt = Date.now() - (entry.offsetMinutes ?? 60) * 60 * 1000;
    await db.insert(transactions).values({
      reference: entry.reference,
      direction: entry.direction,
      amountCents: Math.round(entry.amount * 100),
      currency: entry.currency?.toUpperCase() ?? "INR",
      category: entry.category,
      description: entry.description ?? null,
      requestId: linkedRequestId,
      recordedBy: actorUserId,
      recordedAt,
    });
  }
}

async function seedLiveFeeds(db: Awaited<ReturnType<typeof getDbAsync>>) {
  console.log("Upserting live weather readings and alerts...");
  const weatherExists = await db.select().from(liveWeatherReadings).limit(1);
  if (weatherExists.length === 0) {
    const now = Date.now();
    await db.insert(liveWeatherReadings).values(
      SAMPLE_WEATHER_POINTS.map((point, idx) => ({
        locationName: point.locationName,
        latitude: point.latitude,
        longitude: point.longitude,
        temperatureC: 24 + idx,
        windSpeedKph: 10 + idx,
        humidity: 55 + idx * 3,
        precipitationMm: idx % 2 === 0 ? 1.2 : 0,
        condition: idx % 2 === 0 ? "Cloudy" : "Humid",
        alertLevel: idx === 0 ? "watch" : "normal",
        source: "seed",
        recordedAt: now - idx * 15 * 60 * 1000,
      })),
    );
    console.log("Inserted sample weather readings");
  } else {
    console.log("Weather readings already present; skipping seed");
  }

  const alertExists = await db.select().from(governmentAlerts).limit(1);
  if (alertExists.length === 0) {
    const now = Date.now();
    await db.insert(governmentAlerts).values({
      externalId: `seed-alert-${now}`,
      headline: SAMPLE_ALERT.headline,
      area: SAMPLE_ALERT.area,
      severity: SAMPLE_ALERT.severity,
      certainty: SAMPLE_ALERT.certainty,
      urgency: SAMPLE_ALERT.urgency,
      source: "seed",
      issuedAt: now,
      expiresAt: now + 2 * 60 * 60 * 1000,
      summary: SAMPLE_ALERT.summary,
      rawPayload: null,
      status: "active",
    });
    console.log("Inserted sample government alert");
  } else {
    console.log("Government alerts already present; skipping seed");
  }
}

async function seedDemandSnapshots(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  config: DemandSeedConfig,
) {
  if (!config.bucketCount || config.bucketCount <= 0) {
    console.log("Skipping demand snapshot seed (bucketCount <= 0)");
    return;
  }
  const rows = buildDemandSnapshotRows(config.bucketCount, config.bucketMinutes);
  if (!rows.length) return;
  await db
    .insert(demandFeatureSnapshots)
    .values(rows)
    .onConflictDoUpdate({
      target: [demandFeatureSnapshots.bucketStart, demandFeatureSnapshots.region, demandFeatureSnapshots.resourceType],
      set: {
        requestCount: sql`excluded.request_count`,
        pendingCount: sql`excluded.pending_count`,
        inProgressCount: sql`excluded.in_progress_count`,
        fulfilledCount: sql`excluded.fulfilled_count`,
        cancelledCount: sql`excluded.cancelled_count`,
        avgPeople: sql`excluded.avg_people`,
        avgSeverityScore: sql`excluded.avg_severity_score`,
        medianWaitMins: sql`excluded.median_wait_mins`,
        inventoryAvailable: sql`excluded.inventory_available`,
        openAllocations: sql`excluded.open_allocations`,
        weatherAlertLevel: sql`excluded.weather_alert_level`,
        precipitationMm: sql`excluded.precipitation_mm`,
        windSpeedKph: sql`excluded.wind_speed_kph`,
        humidity: sql`excluded.humidity`,
        createdAt: Date.now(),
      },
    });
  console.log(
    `Inserted ${rows.length} demand snapshot rows across ${config.bucketCount} buckets (width=${config.bucketMinutes}m)`,
  );
}

async function seedProviderHealthTelemetry() {
  console.log("Triggering provider health ingestion seed...");
  if (!isProviderHealthEnabled()) {
    console.log("Provider health feature disabled; skipping telemetry seed");
    return;
  }

  try {
    const summary = await ingestProviderHealthTelemetry();
    if (summary.skipped) {
      console.log("Provider health ingestion skipped (ingestor already running)");
      return;
    }
    console.log(
      `Seeded provider telemetry for ${summary.updatedProviders.length} providers ` +
        `(snapshots=${summary.ingested}, events=${summary.events}, rosters=${summary.rosters})`,
    );
  } catch (error) {
    console.error("Provider health ingestion seed failed", error);
    throw error;
  }
}

function buildDemandSnapshotRows(bucketCount: number, bucketMinutes: number) {
  const bucketMs = Math.max(5, bucketMinutes || 30) * 60 * 1000;
  const alignedNow = Math.floor(Date.now() / bucketMs) * bucketMs;
  const rows: typeof demandFeatureSnapshots.$inferInsert[] = [];

  for (let bucketIndex = bucketCount - 1; bucketIndex >= 0; bucketIndex -= 1) {
    const bucketEnd = alignedNow - (bucketCount - 1 - bucketIndex) * bucketMs;
    const bucketStart = bucketEnd - bucketMs;
    for (const region of DEMAND_REGION_PROFILES) {
      region.resources.forEach((resource, resourceIdx) => {
        const seed = bucketIndex * 991 + resourceIdx * 131;
        const requestCount = jitter(resource.baseRequest + bucketIndex * resource.trend, resource.variance, seed);
        const pendingCount = Math.max(0, Math.round(requestCount * resource.pendingRatio));
        const inProgressCount = Math.max(0, Math.round(requestCount * resource.inProgressRatio));
        const cancelledCount = Math.max(0, Math.round(requestCount * resource.cancelledRatio));
        const fulfilledCount = Math.max(0, requestCount - pendingCount - inProgressCount - cancelledCount);
        const avgPeople = Number((resource.avgPeople + centeredNoise(seed + 11) * 0.6).toFixed(1));
        const avgSeverity = Number((resource.avgSeverity + centeredNoise(seed + 17) * 4).toFixed(1));
        const medianWait = Number((resource.waitMins + centeredNoise(seed + 23) * resource.waitVariance).toFixed(1));
        const inventoryAvailable = Math.max(50, Math.round(resource.inventoryBase - bucketIndex * resource.inventoryDecay));
        const openAllocations = Math.max(
          0,
          Math.round(resource.openAllocationsBase + bucketIndex * resource.allocationTrend),
        );
        const precipitation = Number((region.weather.precipitation + centeredNoise(seed + 5) * 2).toFixed(1));
        const wind = Number((region.weather.wind + centeredNoise(seed + 7) * 3).toFixed(1));
        const humidity = Math.min(100, Math.max(30, Math.round(region.weather.humidity + centeredNoise(seed + 9) * 4)));

        rows.push({
          bucketStart,
          bucketEnd,
          region: region.region,
          resourceType: resource.type,
          requestCount,
          pendingCount,
          inProgressCount,
          fulfilledCount,
          cancelledCount,
          avgPeople,
          avgSeverityScore: avgSeverity,
          medianWaitMins: medianWait,
          inventoryAvailable,
          openAllocations,
          weatherAlertLevel: region.weather.alertLevel,
          precipitationMm: precipitation,
          windSpeedKph: wind,
          humidity,
        });
      });
    }
  }

  return rows;
}

function jitter(base: number, variance: number, seed: number) {
  const value = base + centeredNoise(seed) * variance;
  return Math.max(0, Math.round(value));
}

function noise(seed: number) {
  return (Math.sin(seed * 9301 + 49297) + 1) / 2;
}

function centeredNoise(seed: number) {
  return noise(seed) - 0.5;
}

seedDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
