import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  demandFeatureSnapshots,
  liveWeatherReadings,
  rescueRequests,
  resourceAllocations,
  resources,
  warehouses,
} from "../db/schema";
import { buildStatsKey, inferResourceType, normalizeRegion } from "./predictive-utils";
import { decryptField } from "../security/encryption";

const SNAPSHOT_INTERVAL_MINUTES = Number(process.env.DEMAND_SNAPSHOT_BUCKET_MINUTES ?? 30);
const SNAPSHOT_INTERVAL_MS = Math.max(5, SNAPSHOT_INTERVAL_MINUTES || 30) * 60 * 1000;
const ACTIVE_REQUEST_STATUSES = ["pending", "in_progress"] as const;
const ACTIVE_ALLOCATION_STATUSES = ["booked", "dispatched"] as const;

export async function generateDemandFeatureSnapshot(now = new Date()) {
  const db = getDb();
  const bucketEndMs = alignToBucket(now.getTime());
  const bucketStartMs = bucketEndMs - SNAPSHOT_INTERVAL_MS;
  const bucketStartDate = new Date(bucketStartMs);
  const bucketEndDate = new Date(bucketEndMs);

  const metrics = new Map<string, RegionResourceMetrics>();

  const recentRequests = await db
    .select({
      id: rescueRequests.id,
      location: rescueRequests.location,
      status: rescueRequests.status,
      peopleCount: rescueRequests.peopleCount,
      criticalityScore: rescueRequests.criticalityScore,
      details: rescueRequests.details,
      createdAt: rescueRequests.createdAt,
    })
    .from(rescueRequests)
    .where(and(gte(rescueRequests.createdAt, bucketStartMs), lt(rescueRequests.createdAt, bucketEndMs)));

  for (const request of recentRequests) {
    const region = normalizeRegion(request.location);
    const details = decryptField(request.details) ?? "";
    const resourceType = inferResourceType(details).toLowerCase();
    const metric = ensureMetric(metrics, region, resourceType);
    metric.requestCount += 1;
    metric.sampleCount += 1;
    metric.peopleSum += request.peopleCount ?? 0;
    metric.severitySum += request.criticalityScore ?? 0;
    if (request.status === "fulfilled") metric.fulfilledCount += 1;
    if (request.status === "cancelled") metric.cancelledCount += 1;
  }

  const activeRequests = await db
    .select({
      id: rescueRequests.id,
      location: rescueRequests.location,
      status: rescueRequests.status,
      details: rescueRequests.details,
    })
    .from(rescueRequests)
    .where(inArray(rescueRequests.status, ACTIVE_REQUEST_STATUSES));

  for (const request of activeRequests) {
    const region = normalizeRegion(request.location);
    const details = decryptField(request.details) ?? "";
    const resourceType = inferResourceType(details).toLowerCase();
    const metric = ensureMetric(metrics, region, resourceType);
    if (request.status === "pending") metric.pendingCount += 1;
    if (request.status === "in_progress") metric.inProgressCount += 1;
  }

  const allocationRows = await db
    .select({
      location: rescueRequests.location,
      resourceType: resources.type,
    })
    .from(resourceAllocations)
    .leftJoin(rescueRequests, eq(resourceAllocations.requestId, rescueRequests.id))
    .leftJoin(resources, eq(resourceAllocations.resourceId, resources.id))
    .where(inArray(resourceAllocations.status, ACTIVE_ALLOCATION_STATUSES));

  for (const allocation of allocationRows) {
    const region = normalizeRegion(allocation.location);
    const resourceType = (allocation.resourceType ?? "general supplies").toLowerCase();
    const metric = ensureMetric(metrics, region, resourceType);
    metric.openAllocations += 1;
  }

  const updatedRequests = await db
    .select({
      location: rescueRequests.location,
      details: rescueRequests.details,
      createdAt: rescueRequests.createdAt,
      updatedAt: rescueRequests.updatedAt,
      status: rescueRequests.status,
    })
    .from(rescueRequests)
    .where(
      and(
        inArray(rescueRequests.status, ["in_progress", "fulfilled"] as const),
        gte(rescueRequests.updatedAt, bucketStartMs),
        lt(rescueRequests.updatedAt, bucketEndMs),
      ),
    );

  for (const entry of updatedRequests) {
    const region = normalizeRegion(entry.location);
    const details = decryptField(entry.details) ?? "";
    const resourceType = inferResourceType(details).toLowerCase();
    const metric = ensureMetric(metrics, region, resourceType);
    const updatedAtMs = normalizeTimestamp(entry.updatedAt);
    const createdAtMs = normalizeTimestamp(entry.createdAt);
    const duration = Math.max(0, updatedAtMs - createdAtMs);
    const minutes = duration / (60 * 1000);
    if (minutes > 0) {
      metric.waitTimes.push(minutes);
    }
  }

  const inventoryRows = await db
    .select({
      quantity: resources.quantity,
      type: resources.type,
      location: warehouses.location,
    })
    .from(resources)
    .innerJoin(warehouses, eq(resources.warehouseId, warehouses.id));

  for (const row of inventoryRows) {
    const region = normalizeRegion(row.location);
    const resourceType = (row.type ?? "general supplies").toLowerCase();
    const metric = ensureMetric(metrics, region, resourceType);
    metric.inventoryAvailable += row.quantity ?? 0;
  }

  const weatherRows = await db
    .select()
    .from(liveWeatherReadings)
    .orderBy(desc(liveWeatherReadings.recordedAt))
    .limit(100);
  const seenRegion = new Set<string>();
  for (const reading of weatherRows) {
    const region = normalizeRegion(reading.locationName ?? reading.source ?? undefined);
    if (seenRegion.has(region)) continue;
    seenRegion.add(region);
    for (const resourceType of resourceTypesForRegion(metrics, region)) {
      const metric = ensureMetric(metrics, region, resourceType);
      metric.weatherAlertLevel = reading.alertLevel ?? metric.weatherAlertLevel;
      metric.precipitationSum += reading.precipitationMm ?? 0;
      metric.windSum += reading.windSpeedKph ?? 0;
      metric.humiditySum += reading.humidity ?? 0;
      metric.weatherSamples += 1;
    }
  }

  if (!metrics.size) {
    console.info("[demand-snapshot] no data available for bucket", bucketStartDate.toISOString());
    return { bucketStart: bucketStartMs, bucketEnd: bucketEndMs, inserted: 0 };
  }

  const rows = Array.from(metrics.values()).map((metric) => {
    const avgPeople = metric.sampleCount ? metric.peopleSum / metric.sampleCount : null;
    const avgSeverity = metric.sampleCount ? metric.severitySum / metric.sampleCount : null;
    const precipitation = metric.weatherSamples ? metric.precipitationSum / metric.weatherSamples : null;
    const wind = metric.weatherSamples ? metric.windSum / metric.weatherSamples : null;
    const humidity = metric.weatherSamples ? metric.humiditySum / metric.weatherSamples : null;
    const medianWait = metric.waitTimes.length ? median(metric.waitTimes) : null;
    return {
      bucketStart: bucketStartMs,
      bucketEnd: bucketEndMs,
      region: metric.region,
      resourceType: metric.resourceType,
      requestCount: metric.requestCount,
      pendingCount: metric.pendingCount,
      inProgressCount: metric.inProgressCount,
      fulfilledCount: metric.fulfilledCount,
      cancelledCount: metric.cancelledCount,
      avgPeople,
      avgSeverityScore: avgSeverity,
      medianWaitMins: medianWait,
      inventoryAvailable: metric.inventoryAvailable > 0 ? metric.inventoryAvailable : null,
      openAllocations: metric.openAllocations > 0 ? metric.openAllocations : null,
      weatherAlertLevel: metric.weatherAlertLevel,
      precipitationMm: precipitation,
      windSpeedKph: wind,
      humidity,
    };
  });

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

  console.info(`[*] demand snapshot bucket=${bucketStartDate.toISOString()} rows=${rows.length}`);
  return {
    bucketStart: bucketStartMs,
    bucketEnd: bucketEndMs,
    inserted: rows.length,
  };
}

function alignToBucket(timestamp: number) {
  return Math.floor(timestamp / SNAPSHOT_INTERVAL_MS) * SNAPSHOT_INTERVAL_MS;
}

function normalizeTimestamp(value: number | Date | null) {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return 0;
}

type RegionResourceMetrics = {
  region: string;
  resourceType: string;
  requestCount: number;
  pendingCount: number;
  inProgressCount: number;
  fulfilledCount: number;
  cancelledCount: number;
  peopleSum: number;
  severitySum: number;
  sampleCount: number;
  inventoryAvailable: number;
  openAllocations: number;
  weatherAlertLevel: string | null;
  precipitationSum: number;
  windSum: number;
  humiditySum: number;
  weatherSamples: number;
  waitTimes: number[];
};

function ensureMetric(map: Map<string, RegionResourceMetrics>, region: string, resourceType: string) {
  const key = buildStatsKey(region, resourceType);
  if (!map.has(key)) {
    map.set(key, {
      region,
      resourceType,
      requestCount: 0,
      pendingCount: 0,
      inProgressCount: 0,
      fulfilledCount: 0,
      cancelledCount: 0,
      peopleSum: 0,
      severitySum: 0,
      sampleCount: 0,
      inventoryAvailable: 0,
      openAllocations: 0,
      weatherAlertLevel: null,
      precipitationSum: 0,
      windSum: 0,
      humiditySum: 0,
      weatherSamples: 0,
      waitTimes: [],
    });
  }
  return map.get(key)!;
}

function resourceTypesForRegion(metrics: Map<string, RegionResourceMetrics>, region: string) {
  const values = new Set<string>();
  for (const metric of metrics.values()) {
    if (metric.region === region) values.add(metric.resourceType);
  }
  return Array.from(values);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
