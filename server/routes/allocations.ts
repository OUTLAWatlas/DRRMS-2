import { Router } from "express";
import { getDb } from "../db";
import { allocationHistory, resourceAllocations, resources, rescueRequests, warehouses, users } from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { createAllocationSchema } from "../../shared/api";

const router = Router();

// POST /api/allocations - Allocate resources (Rescuers only)
router.post("/", authMiddleware, rescuerOnly, async (req: AuthRequest, res) => {
  try {
    const validatedData = createAllocationSchema.parse(req.body);
    const { requestId, resources: requestedResources, clientRequestId } = validatedData;

    // Basic checks
    const db = getDb();
    const reqRows = await db.select().from(rescueRequests).where(eq(rescueRequests.id, requestId));
    if (reqRows.length === 0) return res.status(400).json({ error: "Rescue request does not exist" });
    const request = reqRows[0];
    const createdAllocations: Array<{ record: typeof resourceAllocations.$inferSelect; clientRequestId?: string }> = [];

    // Transaction to ensure atomicity
    await db.transaction(async (tx) => {
      for (const resReq of requestedResources) {
        // 1. Check if sufficient resource quantity exists
        const rows = await tx
          .select({ quantity: resources.quantity, warehouseId: resources.warehouseId })
          .from(resources)
          .where(eq(resources.id, resReq.resourceId));
        const current = rows[0];
        if (!current || (current.quantity ?? 0) < resReq.quantity) {
          throw new Error(`Insufficient quantity for resource ID ${resReq.resourceId}`);
        }

        // 2. Insert allocation record
        const [allocation] = await tx
          .insert(resourceAllocations)
          .values({
            requestId,
            resourceId: resReq.resourceId,
            quantity: resReq.quantity,
            allocatedBy: req.user!.userId,
            status: "booked",
            latitude: request.latitude ?? null,
            longitude: request.longitude ?? null,
          })
          .returning();

        createdAllocations.push({ record: allocation, clientRequestId: resReq.clientRequestId });

        // 3. Decrement resource quantity
        const resourceTimestamp = Date.now();
        await tx
          .update(resources)
          .set({
            quantity: sql`${resources.quantity} - ${resReq.quantity}`,
            updatedAt: resourceTimestamp,
            version: sql`${resources.version} + 1`,
          })
          .where(eq(resources.id, resReq.resourceId));

        await tx.insert(allocationHistory).values({
          allocationId: allocation.id,
          requestId,
          resourceId: resReq.resourceId,
          warehouseId: current.warehouseId,
          quantity: resReq.quantity,
          eventType: "booked",
          actorId: req.user!.userId,
        });
      }

      const statusTimestamp = Date.now();
      await tx
        .update(rescueRequests)
        .set({
          status: "in_progress",
          updatedAt: statusTimestamp,
          version: sql`${rescueRequests.version} + 1`,
        })
        .where(eq(rescueRequests.id, requestId));
    });

    const allocationsResponse = createdAllocations.map(({ record, clientRequestId }) =>
      buildMutationResponse(record, clientRequestId),
    );
    const responsePayload: { allocations: typeof allocationsResponse; clientRequestId?: string } = {
      allocations: allocationsResponse,
    };
    if (clientRequestId) {
      responsePayload.clientRequestId = clientRequestId;
    }
    res.status(201).json(responsePayload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid allocation data", details: error.errors });
    }
    console.error("Allocation failed:", error);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Allocation failed" });
  }
});

// GET /api/allocations - List all allocations (Rescuers only)
router.get("/", authMiddleware, rescuerOnly, async (req, res) => {
  const updatedAfter = parseTimestamp(req.query["updatedAfter"] ?? req.query["updated_after"]);
  const db = getDb();
  const baseQuery = db.select().from(resourceAllocations);
  const filteredQuery = updatedAfter ? baseQuery.where(gt(resourceAllocations.updatedAt, updatedAfter)) : baseQuery;
  const allocations = await filteredQuery.orderBy(desc(resourceAllocations.allocatedAt));
  res.json(allocations);
});

router.get("/history", authMiddleware, rescuerOnly, async (req, res) => {
  const filters = parseAllocationHistoryFilters(req.query as Record<string, unknown>);
  const db = getDb();
  const baseQuery = db
    .select({
      id: allocationHistory.id,
      allocationId: allocationHistory.allocationId,
      requestId: allocationHistory.requestId,
      resourceId: allocationHistory.resourceId,
      warehouseId: allocationHistory.warehouseId,
      quantity: allocationHistory.quantity,
      eventType: allocationHistory.eventType,
      note: allocationHistory.note,
      actorId: allocationHistory.actorId,
      createdAt: allocationHistory.createdAt,
      resourceType: resources.type,
      warehouseName: warehouses.name,
      actorName: users.name,
    })
    .from(allocationHistory)
    .leftJoin(resources, eq(allocationHistory.resourceId, resources.id))
    .leftJoin(warehouses, eq(allocationHistory.warehouseId, warehouses.id))
    .leftJoin(users, eq(allocationHistory.actorId, users.id))
    .orderBy(desc(allocationHistory.createdAt));

  const whereClause = buildAllocationHistoryWhere(filters);
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const limitedQuery = filters.limit ? filteredQuery.limit(filters.limit) : filteredQuery;

  const history = await limitedQuery;
  res.json(history);
});

router.get("/history/export", authMiddleware, rescuerOnly, async (req, res) => {
  const filters = parseAllocationHistoryFilters(req.query as Record<string, unknown>);
  const db = getDb();
  const baseQuery = db
    .select({
      createdAt: allocationHistory.createdAt,
      requestId: allocationHistory.requestId,
      resourceId: allocationHistory.resourceId,
      resourceType: resources.type,
      warehouseId: allocationHistory.warehouseId,
      warehouseName: warehouses.name,
      eventType: allocationHistory.eventType,
      quantity: allocationHistory.quantity,
      actorId: allocationHistory.actorId,
      actorName: users.name,
      note: allocationHistory.note,
    })
    .from(allocationHistory)
    .leftJoin(resources, eq(allocationHistory.resourceId, resources.id))
    .leftJoin(warehouses, eq(allocationHistory.warehouseId, warehouses.id))
    .leftJoin(users, eq(allocationHistory.actorId, users.id))
    .orderBy(desc(allocationHistory.createdAt));

  const whereClause = buildAllocationHistoryWhere(filters);
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const exportLimit = filters.limit ?? 2000;
  const rows = await filteredQuery.limit(exportLimit);
  const header = [
    "timestamp",
    "event_type",
    "request_id",
    "resource_id",
    "resource_type",
    "warehouse_id",
    "warehouse_name",
    "quantity",
    "actor_id",
    "actor_name",
    "note",
  ];
  const csvRows = rows.map((row) => [
    new Date(row.createdAt).toISOString(),
    row.eventType,
    row.requestId ?? "",
    row.resourceId ?? "",
    row.resourceType ?? "",
    row.warehouseId ?? "",
    row.warehouseName ?? "",
    row.quantity,
    row.actorId ?? "",
    row.actorName ?? "",
    row.note ?? "",
  ]);
  const csvContent = [header, ...csvRows]
    .map((line) => line.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=allocation_history_${new Date().toISOString().slice(0, 10)}.csv`,
  );
  res.send(csvContent);
});

// GET /api/allocations/:id - Get single allocation (Rescuers only)
router.get("/:id", authMiddleware, rescuerOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid allocation ID" });
    }
  const db = getDb();
  const rows = await db.select().from(resourceAllocations).where(eq(resourceAllocations.id, id));
    const allocation = rows[0];
    if (!allocation) {
      return res.status(404).json({ error: "Allocation not found" });
    }
    res.json(allocation);
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

type AllocationHistoryFilters = {
  startMs?: number;
  endMs?: number;
  resourceId?: number;
  warehouseId?: number;
  requestId?: number;
  eventType?: "booked" | "dispatched" | "released";
  limit?: number;
};

function parseAllocationHistoryFilters(query: Record<string, unknown>): AllocationHistoryFilters {
  return {
    startMs: parseDateValue(query["start"]),
    endMs: parseDateValue(query["end"]),
    resourceId: parsePositiveInt(query["resourceId"]),
    warehouseId: parsePositiveInt(query["warehouseId"]),
    requestId: parsePositiveInt(query["requestId"]),
    eventType: parseEventType(query["eventType"]),
    limit: parsePositiveInt(query["limit"], 1, 5000),
  };
}

function buildAllocationHistoryWhere(filters: AllocationHistoryFilters): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];
  if (filters.startMs) {
    conditions.push(gte(allocationHistory.createdAt, filters.startMs));
  }
  if (filters.endMs) {
    conditions.push(lte(allocationHistory.createdAt, filters.endMs));
  }
  if (filters.resourceId) {
    conditions.push(eq(allocationHistory.resourceId, filters.resourceId));
  }
  if (filters.warehouseId) {
    conditions.push(eq(allocationHistory.warehouseId, filters.warehouseId));
  }
  if (filters.requestId) {
    conditions.push(eq(allocationHistory.requestId, filters.requestId));
  }
  if (filters.eventType) {
    conditions.push(eq(allocationHistory.eventType, filters.eventType));
  }
  if (!conditions.length) return undefined;
  return conditions.reduce<SQL<unknown> | undefined>((acc, condition) => (acc ? and(acc, condition) : condition), undefined);
}

function parseDateValue(value: unknown): number | undefined {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parsePositiveInt(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): number | undefined {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(Math.max(parsed, min), max);
}

function parseEventType(value: unknown): "booked" | "dispatched" | "released" | undefined {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "booked" || normalized === "dispatched" || normalized === "released") {
    return normalized;
  }
  return undefined;
}

function getQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return undefined;
  }
  return String(value);
}

function parseTimestamp(value: unknown) {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function buildMutationResponse<T>(record: T, clientRequestId?: string) {
  return clientRequestId ? { record, clientRequestId } : { record };
}

function escapeCsvValue(value: string): string {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
