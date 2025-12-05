import { Router } from "express";
import { authMiddleware, rescuerOnly } from "../middleware/auth";
import { getDb } from "../db";
import {
  rescueRequests,
  warehouses,
  resources,
  resourceAllocations,
} from "../db/schema";
import { indiaCriticalAssets } from "../data/critical-assets";
import { and, eq, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/overview", authMiddleware, rescuerOnly, async (_req, res) => {
  const db = getDb();
  const requestsWithCoords = await db
    .select({
      id: rescueRequests.id,
      latitude: rescueRequests.latitude,
      longitude: rescueRequests.longitude,
      status: rescueRequests.status,
      priority: rescueRequests.priority,
      peopleCount: rescueRequests.peopleCount,
      criticalityScore: rescueRequests.criticalityScore,
      updatedAt: rescueRequests.updatedAt,
    })
    .from(rescueRequests)
    .where(sql`${rescueRequests.latitude} IS NOT NULL AND ${rescueRequests.longitude} IS NOT NULL`);

  const warehouseRows = await db
    .select({
      id: warehouses.id,
      name: warehouses.name,
      latitude: warehouses.latitude,
      longitude: warehouses.longitude,
      capacity: warehouses.capacity,
      stockLevel: sql`COALESCE(SUM(${resources.quantity}), 0)`,
    })
    .from(warehouses)
    .leftJoin(resources, eq(resources.warehouseId, warehouses.id))
    .groupBy(warehouses.id);

  const allocationRows = await db
    .select({
      id: resourceAllocations.id,
      requestId: resourceAllocations.requestId,
      resourceId: resourceAllocations.resourceId,
      latitude: resourceAllocations.latitude,
      longitude: resourceAllocations.longitude,
      status: resourceAllocations.status,
      quantity: resourceAllocations.quantity,
      allocatedAt: resourceAllocations.allocatedAt,
    })
    .from(resourceAllocations)
    .where(sql`${resourceAllocations.latitude} IS NOT NULL AND ${resourceAllocations.longitude} IS NOT NULL`);

  res.json({
    requests: requestsWithCoords.map((r) => ({
      id: r.id,
      latitude: r.latitude!,
      longitude: r.longitude!,
      status: r.status,
      priority: r.priority,
      peopleCount: r.peopleCount,
      criticalityScore: r.criticalityScore,
      updatedAt: r.updatedAt,
    })),
    warehouses: warehouseRows
      .filter((w) => w.latitude !== null && w.longitude !== null)
      .map((w) => ({
        id: w.id,
        name: w.name,
        latitude: Number(w.latitude),
        longitude: Number(w.longitude),
        capacity: w.capacity,
        stockLevel: Number(w.stockLevel ?? 0),
      })),
    allocations: allocationRows.map((a) => ({
      id: a.id,
      requestId: a.requestId,
      resourceId: a.resourceId,
      latitude: a.latitude!,
      longitude: a.longitude!,
      status: a.status,
      quantity: a.quantity,
      allocatedAt: a.allocatedAt,
    })),
    criticalAssets: indiaCriticalAssets,
  });
});

router.get("/heatmap", authMiddleware, rescuerOnly, async (req, res) => {
  const bucketSize = req.query.bucket ? Math.max(0.05, parseFloat(String(req.query.bucket))) : 0.25;
  const windowHours = req.query.window ? Math.max(1, parseInt(String(req.query.window), 10)) : 24;
  const sinceMs = Date.now() - windowHours * 60 * 60 * 1000;
  const db = getDb();
  const rows = await db
    .select({
      id: rescueRequests.id,
      latitude: rescueRequests.latitude,
      longitude: rescueRequests.longitude,
      status: rescueRequests.status,
    })
    .from(rescueRequests)
    .where(
      and(
        gte(rescueRequests.createdAt, sinceMs),
        sql`${rescueRequests.latitude} IS NOT NULL`,
        sql`${rescueRequests.longitude} IS NOT NULL`,
      ),
    );

  const buckets = new Map<string, {
    id: string;
    latitude: number;
    longitude: number;
    total: number;
    pending: number;
    inProgress: number;
    fulfilled: number;
    cancelled: number;
  }>();

  const roundToBucket = (value: number) => Math.round(value / bucketSize) * bucketSize;

  for (const row of rows) {
    const lat = row.latitude!;
    const lon = row.longitude!;
    const latBucket = Number(roundToBucket(lat).toFixed(4));
    const lonBucket = Number(roundToBucket(lon).toFixed(4));
    const key = `${latBucket}|${lonBucket}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: key,
        latitude: latBucket,
        longitude: lonBucket,
        total: 0,
        pending: 0,
        inProgress: 0,
        fulfilled: 0,
        cancelled: 0,
      });
    }
    const bucket = buckets.get(key)!;
    bucket.total += 1;
    switch (row.status) {
      case "pending":
        bucket.pending += 1;
        break;
      case "in_progress":
        bucket.inProgress += 1;
        break;
      case "fulfilled":
        bucket.fulfilled += 1;
        break;
      case "cancelled":
        bucket.cancelled += 1;
        break;
      default:
        break;
    }
  }

  res.json({ buckets: Array.from(buckets.values()) });
});

export default router;
