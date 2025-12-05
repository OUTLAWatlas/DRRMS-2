import { Router } from "express";
import { getDb } from "../db";
import { resources } from "../db/schema";
import { authMiddleware, rescuerOnly } from "../middleware/auth";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, gt, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { updateResourceSchema, createResourceSchema } from "../../shared/api";
import { requirePermission } from "../security/permissions";

const router = Router();

// GET /api/resources - List all resources (Rescuers only)
router.get("/", authMiddleware, rescuerOnly, requirePermission("resources:read"), async (req, res) => {
  const db = getDb();
  const filters = parseResourceFilters(req.query as Record<string, unknown>);
  const whereClause = buildResourceWhere(filters);

  const baseQuery = db.select().from(resources).orderBy(desc(resources.updatedAt));
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const limitedQuery = filters.limit ? filteredQuery.limit(filters.limit) : filteredQuery;
  const paginatedQuery = filters.limit && filters.page ? limitedQuery.offset((filters.page - 1) * filters.limit) : limitedQuery;

  const rows = await paginatedQuery;

  if (filters.page && filters.limit) {
    const total = await countResources(db, whereClause);
    const totalPages = Math.max(1, Math.ceil(total / filters.limit));
    return res.json({
      resources: rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    });
  }

  res.json(rows);
});

router.get("/low-stock", authMiddleware, rescuerOnly, requirePermission("resources:read"), async (req, res) => {
  const db = getDb();
  const warehouseId = parsePositiveInt(req.query["warehouseId"], 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePositiveInt(req.query["limit"], 1, 500) ?? 50;
  const includeDepleted = parseBoolean(req.query["includeDepleted"], true);
  const buffer = parsePositiveInt(req.query["buffer"], 0, 10_000) ?? 0;

  const whereClause = buildLowStockWhere({ warehouseId, includeDepleted, buffer });

  const lowStockResources = await db
    .select()
    .from(resources)
    .where(whereClause)
    .orderBy(asc(resources.quantity), asc(resources.reorderLevel))
    .limit(limit);

  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(resources)
    .where(whereClause);

  res.json({
    resources: lowStockResources,
    meta: {
      limit,
      total,
      warehouseId,
      includeDepleted,
      buffer,
    },
  });
});

// GET /api/resources/:id - Get single resource (Rescuers only)
router.get("/:id", authMiddleware, rescuerOnly, requirePermission("resources:read"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid resource ID" });
    }
  const db = getDb();
  const rows = await db.select().from(resources).where(eq(resources.id, id));
    const resource = rows[0];
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }
    res.json(resource);
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/resources - Add resource (Rescuers only)
router.post("/", authMiddleware, rescuerOnly, requirePermission("resources:write"), async (req, res) => {
  try {
    const { clientRequestId, ...validatedData } = createResourceSchema.parse(req.body);
    const db = getDb();
    const [newResource] = await db
      .insert(resources)
      .values({
        type: validatedData.type,
        quantity: validatedData.quantity,
        warehouseId: validatedData.warehouseId,
        unit: validatedData.unit ?? "units",
        reorderLevel: validatedData.reorderLevel ?? 0,
      })
      .returning();
    res.status(201).json(buildMutationResponse(newResource, clientRequestId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid resource data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/resources/:id - Update resource (Rescuers only)
router.put("/:id", authMiddleware, rescuerOnly, requirePermission("resources:write"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid resource ID" });
    }
    const { clientRequestId, ...validatedData } = updateResourceSchema.parse(req.body);

    const db = getDb();
    const now = Date.now();
    const [updatedResource] = await db
      .update(resources)
      .set({
        ...validatedData,
        updatedAt: now,
        version: sql`${resources.version} + 1`,
      })
      .where(eq(resources.id, id))
      .returning();

    if (!updatedResource) {
      return res.status(404).json({ error: "Resource not found" });
    }
    res.json(buildMutationResponse(updatedResource, clientRequestId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/resources/:id - Delete resource (Rescuers only)
router.delete("/:id", authMiddleware, rescuerOnly, requirePermission("resources:write"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid resource ID" });
    }

  const db = getDb();
  const deleted = await db.delete(resources).where(eq(resources.id, id)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ error: "Resource not found" });
    }
    res.status(204).send();
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

type ResourceFilters = {
  warehouseId?: number;
  type?: string;
  page?: number;
  limit?: number;
  updatedAfter?: number;
};

type LowStockFilters = {
  warehouseId?: number;
  includeDepleted: boolean;
  buffer: number;
};

function parseResourceFilters(query: Record<string, unknown>): ResourceFilters {
  const warehouseId = parsePositiveInt(query["warehouseId"] ?? query["warehouse_id"], 1, Number.MAX_SAFE_INTEGER);
  const typeValue = parseString(query["type"] ?? query["resourceType"]);
  const page = parsePositiveInt(query["page"], 1, 10_000);
  let limit = parsePositiveInt(query["limit"], 1, 500) ?? undefined;
  const updatedAfter = parseTimestamp(query["updatedAfter"] ?? query["updated_after"]);

  if (page && !limit) {
    limit = 25;
  }

  return {
    warehouseId,
    type: typeValue,
    page,
    limit,
    updatedAfter,
  };
}

function buildResourceWhere(filters: ResourceFilters): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];
  if (filters.warehouseId) {
    conditions.push(eq(resources.warehouseId, filters.warehouseId));
  }
  if (filters.type) {
    conditions.push(ilike(resources.type, `%${filters.type}%`));
  }
  if (filters.updatedAfter) {
    conditions.push(gt(resources.updatedAt, filters.updatedAfter));
  }
  if (!conditions.length) return undefined;
  return conditions.reduce<SQL<unknown> | undefined>((acc, condition) => (acc ? and(acc, condition) : condition), undefined);
}

function buildLowStockWhere(filters: LowStockFilters): SQL<unknown> {
  const conditions: SQL<unknown>[] = [];

  const threshold = sql`${resources.reorderLevel} + ${filters.buffer}`;
  const lowStockCondition = and(gt(resources.reorderLevel, 0), lte(resources.quantity, threshold));
  const depletedCondition = eq(resources.quantity, 0);

  if (filters.includeDepleted) {
    conditions.push(or(lowStockCondition, depletedCondition));
  } else {
    conditions.push(lowStockCondition);
  }

  if (filters.warehouseId) {
    conditions.push(eq(resources.warehouseId, filters.warehouseId));
  }

  return conditions.reduce((acc, condition) => (acc ? and(acc, condition) : condition));
}

async function countResources(
  db: Awaited<ReturnType<typeof getDb>>,
  whereClause: SQL<unknown> | undefined,
): Promise<number> {
  const countQuery = db.select({ value: sql<number>`count(*)` }).from(resources);
  const finalQuery = whereClause ? countQuery.where(whereClause) : countQuery;
  const result = await finalQuery;
  return Number(result[0]?.value ?? 0);
}

function parsePositiveInt(value: unknown, min: number, max: number): number | undefined {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(Math.max(parsed, min), max);
}

function parseString(value: unknown): string | undefined {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

function parseBoolean(value: unknown, fallback = false) {
  const raw = getQueryValue(value);
  if (raw == null) return fallback;
  const normalized = raw.toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
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
