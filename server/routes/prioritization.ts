import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../db";
import {
  allocationHistory,
  allocationRecommendations,
  requestPrioritySnapshots,
  rescueRequests,
  resourceAllocations,
  resources,
  warehouses,
} from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import {
  evaluateRequestPriority,
  type ResourceCandidate,
  buildWarehouseInventoryMap,
  type WarehouseSnapshot,
} from "../services/prioritization";

const router = Router();

router.get("/", authMiddleware, rescuerOnly, async (_req, res) => {
  const nearestWarehouse = alias(warehouses, "nearest_warehouse");
  const db = getDb();
  const rows = await db
    .select({
      snapshotId: requestPrioritySnapshots.id,
      score: requestPrioritySnapshots.score,
      severityWeight: requestPrioritySnapshots.severityWeight,
      peopleWeight: requestPrioritySnapshots.peopleWeight,
      ageWeight: requestPrioritySnapshots.ageWeight,
      supplyWeight: requestPrioritySnapshots.supplyPressureWeight,
      proximityWeight: requestPrioritySnapshots.proximityWeight,
      hubCapacityWeight: requestPrioritySnapshots.hubCapacityWeight,
      nearestWarehouseId: requestPrioritySnapshots.nearestWarehouseId,
      nearestWarehouseDistanceKm: requestPrioritySnapshots.nearestWarehouseDistanceKm,
      hubCapacityRatio: requestPrioritySnapshots.hubCapacityRatio,
      rationale: requestPrioritySnapshots.rationale,
      request: rescueRequests,
      recommendationId: allocationRecommendations.id,
      recommendationStatus: allocationRecommendations.status,
      recommendationResourceId: allocationRecommendations.resourceId,
      recommendationWarehouseId: allocationRecommendations.warehouseId,
      recommendationQuantity: allocationRecommendations.quantity,
      recommendationScore: allocationRecommendations.score,
      recommendationRationale: allocationRecommendations.rationale,
      resourceType: resources.type,
      warehouseName: warehouses.name,
      nearestWarehouseName: nearestWarehouse.name,
    })
    .from(requestPrioritySnapshots)
    .innerJoin(rescueRequests, eq(requestPrioritySnapshots.requestId, rescueRequests.id))
    .leftJoin(
      allocationRecommendations,
      and(
        eq(allocationRecommendations.requestId, rescueRequests.id),
        eq(allocationRecommendations.status, "suggested"),
      ),
    )
    .leftJoin(resources, eq(allocationRecommendations.resourceId, resources.id))
    .leftJoin(warehouses, eq(allocationRecommendations.warehouseId, warehouses.id))
    .leftJoin(nearestWarehouse, eq(requestPrioritySnapshots.nearestWarehouseId, nearestWarehouse.id))
    .orderBy(desc(requestPrioritySnapshots.createdAt));

  const seen = new Set<number>();
  const response = rows
    .filter((row) => {
      if (seen.has(row.request.id)) return false;
      seen.add(row.request.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .map((row) => ({
      snapshotId: row.snapshotId,
      score: row.score,
      severityWeight: row.severityWeight,
      peopleWeight: row.peopleWeight,
      ageWeight: row.ageWeight,
      supplyPressureWeight: row.supplyWeight,
      proximityWeight: row.proximityWeight,
      hubCapacityWeight: row.hubCapacityWeight,
      nearestWarehouseId: row.nearestWarehouseId,
      nearestWarehouseDistanceKm: row.nearestWarehouseDistanceKm,
      hubCapacityRatio: row.hubCapacityRatio,
      nearestWarehouseName: row.nearestWarehouseName,
      rationale: row.rationale,
      request: {
        ...row.request,
        criticalityScore: row.score,
      },
      recommendation: row.recommendationId
        ? {
            id: row.recommendationId,
            requestId: row.request.id,
            resourceId: row.recommendationResourceId,
            warehouseId: row.recommendationWarehouseId,
            quantity: row.recommendationQuantity,
            score: row.recommendationScore ?? row.score,
            status: row.recommendationStatus,
            rationale: row.recommendationRationale,
            resourceType: row.resourceType,
            warehouseName: row.warehouseName,
            createdAt: row.request.createdAt,
          }
        : null,
    }));

  res.json(response);
});

router.post("/recalculate", authMiddleware, rescuerOnly, async (_req, res) => {
  const db = getDb();
  const openRequests = await db
    .select()
    .from(rescueRequests)
    .where(inArray(rescueRequests.status, ["pending", "in_progress"]));
  if (openRequests.length === 0) {
    return res.json({ updated: 0, recalculatedAt: Date.now() });
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

  const context = {
    totalResourceQuantity: resourcePool.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    pendingRequests: openRequests.length,
    warehouses: warehouseSnapshots,
    warehouseInventory,
  };

  const nowMs = Date.now();
  const nowDate = new Date(nowMs);
  await db.transaction(async (tx) => {
    for (const request of openRequests) {
      const evaluation = evaluateRequestPriority(request, resourcePool, context, nowDate);
      await tx
        .update(rescueRequests)
        .set({
          criticalityScore: evaluation.score,
          lastScoredAt: nowMs,
          updatedAt: nowMs,
          version: sql`${rescueRequests.version} + 1`,
        })
        .where(eq(rescueRequests.id, request.id));

      await tx.insert(requestPrioritySnapshots).values({
        requestId: request.id,
        score: evaluation.score,
        severityWeight: evaluation.severityWeight,
        peopleWeight: evaluation.peopleWeight,
        ageWeight: evaluation.ageWeight,
        supplyPressureWeight: evaluation.supplyPressureWeight,
        proximityWeight: evaluation.proximityWeight,
        hubCapacityWeight: evaluation.hubCapacityWeight,
        nearestWarehouseId: evaluation.nearestWarehouseId,
        nearestWarehouseDistanceKm: evaluation.nearestWarehouseDistanceKm,
        hubCapacityRatio: evaluation.hubCapacityRatio,
        recommendedResourceId: evaluation.recommendedResource?.resourceId ?? null,
        recommendedWarehouseId: evaluation.recommendedResource?.warehouseId ?? null,
        recommendedQuantity: evaluation.recommendedResource?.quantity ?? null,
        rationale: evaluation.rationale,
      });

      if (evaluation.recommendedResource) {
        await tx
          .update(allocationRecommendations)
          .set({ status: "dismissed" })
          .where(
            and(
              eq(allocationRecommendations.requestId, request.id),
              eq(allocationRecommendations.status, "suggested"),
            ),
          );

        await tx.insert(allocationRecommendations).values({
          requestId: request.id,
          resourceId: evaluation.recommendedResource.resourceId,
          warehouseId: evaluation.recommendedResource.warehouseId,
          quantity: evaluation.recommendedResource.quantity,
          score: evaluation.score,
          rationale: evaluation.recommendedResource.rationale,
          status: "suggested",
        });
      }
    }
  });

  res.json({ updated: openRequests.length, recalculatedAt: nowMs });
});

router.post("/recommendations/:id/apply", authMiddleware, rescuerOnly, async (req: AuthRequest, res) => {
  const recommendationId = Number(req.params.id);
  if (Number.isNaN(recommendationId)) {
    return res.status(400).json({ error: "Invalid recommendation id" });
  }

  const db = getDb();
  const recommendationRows = await db
    .select({
      recommendation: allocationRecommendations,
      resource: resources,
    })
    .from(allocationRecommendations)
    .leftJoin(resources, eq(resources.id, allocationRecommendations.resourceId))
    .where(eq(allocationRecommendations.id, recommendationId));

  const record = recommendationRows[0];
  if (!record || !record.recommendation) {
    return res.status(404).json({ error: "Recommendation not found" });
  }
  const recommendation = record.recommendation;
  if (recommendation.status !== "suggested") {
    return res.status(400).json({ error: "Recommendation already processed" });
  }
  if (!recommendation.resourceId || !recommendation.quantity) {
    return res.status(400).json({ error: "Recommendation missing resource or quantity" });
  }
  const resourceRow = record.resource;
  if (!resourceRow) {
    return res.status(404).json({ error: "Resource not found" });
  }
  if (resourceRow.quantity < recommendation.quantity) {
    return res.status(400).json({ error: "Insufficient stock to apply recommendation" });
  }

  const timestampMs = Date.now();
  let allocationRecord = null;
  await db.transaction(async (tx) => {
    const [allocation] = await tx
      .insert(resourceAllocations)
      .values({
        requestId: recommendation.requestId,
        resourceId: recommendation.resourceId!,
        quantity: recommendation.quantity!,
        allocatedBy: req.user!.userId,
        status: "booked",
        notes: recommendation.rationale,
      })
      .returning();

    allocationRecord = allocation;

    await tx
      .update(resources)
      .set({
        quantity: sql`${resources.quantity} - ${recommendation.quantity!}`,
        updatedAt: timestampMs,
        version: sql`${resources.version} + 1`,
      })
      .where(eq(resources.id, recommendation.resourceId!));

    await tx.insert(allocationHistory).values({
      allocationId: allocation.id,
      requestId: recommendation.requestId,
      resourceId: recommendation.resourceId!,
      warehouseId: resourceRow.warehouseId,
      quantity: recommendation.quantity!,
      eventType: "booked",
      note: recommendation.rationale,
      actorId: req.user!.userId,
    });

    await tx
      .update(allocationRecommendations)
      .set({ status: "applied", appliedAllocationId: allocation.id })
      .where(eq(allocationRecommendations.id, recommendationId));

    await tx
      .update(rescueRequests)
      .set({
        status: "in_progress",
        updatedAt: timestampMs,
        version: sql`${rescueRequests.version} + 1`,
      })
      .where(eq(rescueRequests.id, recommendation.requestId));
  });

  return res.json({
    message: "Recommendation applied",
    allocation: allocationRecord,
  });
});

export default router;
