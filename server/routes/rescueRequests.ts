import { Router } from "express";
import { getDb } from "../db";
import { rescueRequests, warehouses } from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, gt, gte, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createRescueRequestSchema, updateRescueRequestStatusSchema } from "../../shared/api";
import { encryptField, decryptField } from "../security/encryption";
import { hashSensitiveValue } from "../security/hash";
import { requirePermission } from "../security/permissions";

const router = Router();
const DEFAULT_HUB_RADIUS_KM = 120;
type WarehouseRecord = typeof warehouses.$inferSelect;
type RescueRequestRecord = typeof rescueRequests.$inferSelect;

// POST /api/rescue-requests - Create
router.post("/", authMiddleware, requirePermission("rescue:create"), async (req: AuthRequest, res) => {
  try {
    const payload = normalizeRescuePriority(req.body);
    const { clientRequestId, ...data } = createRescueRequestSchema.parse(payload);
    const db = getDb();
    const [created] = await db
      .insert(rescueRequests)
      .values({
        userId: req.user?.userId,
        location: data.location,
        details: encryptField(data.details)!,
        detailsDigest: hashSensitiveValue(data.details),
        peopleCount: data.peopleCount,
        priority: data.priority,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      })
      .returning();
    res.status(201).json(buildMutationResponse(deserializeRequest(created), clientRequestId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/rescue-requests - List
router.get("/", authMiddleware, requirePermission("rescue:list:own"), async (req: AuthRequest, res) => {
  const db = getDb();
  const role = req.user?.role ?? "survivor";
  const filters = parseRescueRequestFilters(req.query as Record<string, unknown>, role, req.user?.userId);
  const warehouseContext = filters.warehouseId
    ? await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, filters.warehouseId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;
  const { whereClause, requiresDetailSearch } = buildRescueRequestWhere(filters, warehouseContext);
  const orderByClause = buildRescueRequestOrder(filters.sortBy, filters.sortDirection);

  const baseQuery = db.select().from(rescueRequests);
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const orderedQuery = filteredQuery.orderBy(...orderByClause);
  const limitedQuery = filters.limit ? orderedQuery.limit(filters.limit) : orderedQuery;
  const paginatedQuery = filters.limit && filters.page ? limitedQuery.offset((filters.page - 1) * filters.limit) : limitedQuery;

  const rows = await paginatedQuery;
  let payload = rows.map(deserializeRequest);

  if (requiresDetailSearch && filters.search) {
    payload = filterRequestsBySearch(payload, filters.search);
  }

  if (filters.page && filters.limit) {
    const total = await countRescueRequests(db, whereClause);
    const totalPages = Math.max(1, Math.ceil(total / filters.limit));
    return res.json({
      requests: payload,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    });
  }

  return res.json(payload);
});

// GET /api/rescue-requests/:id - Get single request
router.get("/:id", authMiddleware, requirePermission("rescue:list:own"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }
  const db = getDb();
  const rows = await db.select().from(rescueRequests).where(eq(rescueRequests.id, id));
    const request = rows[0];
    if (!request) {
      return res.status(404).json({ error: "Rescue request not found" });
    }
    if (req.user?.role === "survivor" && request.userId !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(deserializeRequest(request));
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/rescue-requests/:id - Update status
router.put("/:id", authMiddleware, rescuerOnly, requirePermission("rescue:update"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }
    const { clientRequestId, ...data } = updateRescueRequestStatusSchema.parse(req.body);
    const db = getDb();
    const now = Date.now();
    const [updated] = await db
      .update(rescueRequests)
      .set({
        status: data.status,
        updatedAt: now,
        version: sql`${rescueRequests.version} + 1`,
      })
      .where(eq(rescueRequests.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Rescue request not found" });
    res.json(buildMutationResponse(deserializeRequest(updated), clientRequestId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

function deserializeRequest(request: typeof rescueRequests.$inferSelect) {
  const { detailsDigest, ...rest } = request;
  return {
    ...rest,
    details: decryptField(request.details),
  };
}

function buildMutationResponse<T>(record: T, clientRequestId?: string) {
  return clientRequestId ? { record, clientRequestId } : { record };
}

type RescueRequestFilters = {
  status?: "pending" | "in_progress" | "fulfilled" | "cancelled";
  priority?: "low" | "medium" | "high";
  userId?: number;
  page?: number;
  limit?: number;
  warehouseId?: number;
  search?: string;
  sortBy?: "createdAt" | "criticalityScore" | "priority";
  sortDirection?: "asc" | "desc";
  updatedAfter?: number;
};

function parseRescueRequestFilters(
  query: Record<string, unknown>,
  role: "survivor" | "rescuer" | "admin",
  currentUserId?: number,
): RescueRequestFilters {
  const status = parseRequestStatus(query["status"]);
  const priority = parsePriority(query["priority"] ?? query["urgency"]);
  const requestedUserId = parsePositiveInt(query["userId"], 1, Number.MAX_SAFE_INTEGER);
  const page = parsePositiveInt(query["page"], 1, 10_000);
  let limit = parsePositiveInt(query["limit"], 1, 200) ?? undefined;
  const warehouseId = parsePositiveInt(query["warehouseId"], 1, Number.MAX_SAFE_INTEGER);
  const search = parseSearchQuery(query["q"] ?? query["search"]);
  const sortBy = parseSortKey(query["sortBy"]);
  const sortDirection = parseSortDirection(query["sortDirection"]);
  const updatedAfter = parseTimestamp(query["updatedAfter"] ?? query["updated_after"]);

  if (page && !limit) {
    limit = 10;
  }

  let userId = requestedUserId;
  if (role === "survivor") {
    userId = currentUserId;
  }

  return {
    status,
    priority,
    userId,
    page,
    limit,
    warehouseId,
    search,
    sortBy,
    sortDirection,
    updatedAfter,
  };
}

function buildRescueRequestWhere(
  filters: RescueRequestFilters,
  warehouse: WarehouseRecord | null,
): { whereClause: SQL<unknown> | undefined; requiresDetailSearch: boolean } {
  const conditions: SQL<unknown>[] = [];
  let requiresDetailSearch = false;

  if (filters.status) {
    conditions.push(eq(rescueRequests.status, filters.status));
  }
  if (filters.priority) {
    conditions.push(eq(rescueRequests.priority, filters.priority));
  }
  if (filters.userId) {
    conditions.push(eq(rescueRequests.userId, filters.userId));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    const numericTerm = Number(filters.search);
    const searchConditions: SQL<unknown>[] = [ilike(rescueRequests.location, term)];
    if (!Number.isNaN(numericTerm)) {
      searchConditions.push(eq(rescueRequests.id, numericTerm));
    }
    conditions.push(or(...searchConditions));
    requiresDetailSearch = true;
  }
  if (filters.warehouseId && warehouse) {
    const locationCondition = buildWarehouseScopeCondition(warehouse);
    if (locationCondition) {
      conditions.push(locationCondition);
    }
  }
  if (filters.updatedAfter) {
    conditions.push(gt(rescueRequests.updatedAt, filters.updatedAfter));
  }
  const whereClause = conditions.length
    ? conditions.reduce<SQL<unknown> | undefined>((acc, condition) => (acc ? and(acc, condition) : condition), undefined)
    : undefined;
  return { whereClause, requiresDetailSearch };
}

function parsePositiveInt(value: unknown, min: number, max: number): number | undefined {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(Math.max(parsed, min), max);
}

function parseRequestStatus(value: unknown) {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "pending" || normalized === "in_progress" || normalized === "fulfilled" || normalized === "cancelled") {
    return normalized as RescueRequestFilters["status"];
  }
  return undefined;
}

function parsePriority(value: unknown) {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized as RescueRequestFilters["priority"];
  }
  return undefined;
}

function parseSearchQuery(value: unknown) {
  const term = getQueryValue(value)?.trim();
  if (!term) return undefined;
  return term.slice(0, 200);
}

function parseSortKey(value: unknown) {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "criticalityscore") return "criticalityScore";
  if (normalized === "priority") return "priority";
  if (normalized === "createdat") return "createdAt";
  return undefined;
}

function parseSortDirection(value: unknown) {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "asc" || normalized === "desc") {
    return normalized as "asc" | "desc";
  }
  return undefined;
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

async function countRescueRequests(
  db: Awaited<ReturnType<typeof getDb>>,
  whereClause: SQL<unknown> | undefined,
) {
  const base = db.select({ value: sql<number>`count(*)` }).from(rescueRequests);
  const result = whereClause ? await base.where(whereClause) : await base;
  return Number(result[0]?.value ?? 0);
}

function buildRescueRequestOrder(
  sortBy: RescueRequestFilters["sortBy"],
  sortDirection: RescueRequestFilters["sortDirection"],
) {
  const direction = sortDirection === "asc" ? asc : desc;
  if (sortBy === "criticalityScore") {
    return [direction(rescueRequests.criticalityScore), desc(rescueRequests.createdAt)];
  }
  if (sortBy === "priority") {
    return [direction(rescueRequests.priority), desc(rescueRequests.createdAt)];
  }
  return [direction(rescueRequests.createdAt)];
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

function normalizeRescuePriority(body: any) {
  if (!body || typeof body !== "object") return body;
  const hasPriority = body.priority != null;
  const hasUrgency = body.urgency != null;
  if (hasPriority || !hasUrgency) {
    return body;
  }
  return {
    ...body,
    priority: body.urgency,
  };
}

function buildWarehouseScopeCondition(warehouse: WarehouseRecord | null): SQL<unknown> | undefined {
  if (!warehouse) return undefined;
  if (warehouse.latitude != null && warehouse.longitude != null) {
    const lat = warehouse.latitude;
    const lon = warehouse.longitude;
    const latDelta = DEFAULT_HUB_RADIUS_KM / 111;
    const lonDelta = DEFAULT_HUB_RADIUS_KM / (111 * Math.cos((lat * Math.PI) / 180));
    return and(
      gte(rescueRequests.latitude, lat - latDelta),
      lte(rescueRequests.latitude, lat + latDelta),
      gte(rescueRequests.longitude, lon - lonDelta),
      lte(rescueRequests.longitude, lon + lonDelta),
    );
  }
  if (warehouse.location) {
    const keyword = `%${warehouse.location.split(",")[0]?.trim() ?? ""}%`;
    return ilike(rescueRequests.location, keyword);
  }
  return undefined;
}

function filterRequestsBySearch(requests: ReturnType<typeof deserializeRequest>[], search: string) {
  const normalized = search.toLowerCase();
  return requests.filter((request) => matchesRescueSearch(request, normalized));
}

function matchesRescueSearch(request: ReturnType<typeof deserializeRequest>, normalized: string) {
  const numericTerm = normalized.replace(/[^0-9]/g, "");
  if (numericTerm && String(request.id).includes(numericTerm)) {
    return true;
  }
  if (request.location?.toLowerCase().includes(normalized)) {
    return true;
  }
  if (request.details?.toLowerCase().includes(normalized)) {
    return true;
  }
  if (request.priority?.toLowerCase().includes(normalized)) {
    return true;
  }
  if (request.status?.toLowerCase().includes(normalized)) {
    return true;
  }
  return false;
}

function sortRescueRequests(
  requests: ReturnType<typeof deserializeRequest>[],
  sortBy: RescueRequestFilters["sortBy"],
  direction: RescueRequestFilters["sortDirection"],
) {
  const sortKey = sortBy ?? "createdAt";
  const sortDirection = direction ?? "desc";
  const multiplier = sortDirection === "asc" ? 1 : -1;
  return [...requests].sort((a, b) => {
    let delta = 0;
    if (sortKey === "criticalityScore") {
      delta = (a.criticalityScore ?? 0) - (b.criticalityScore ?? 0);
    } else if (sortKey === "priority") {
      delta = getPriorityRankValue(a.priority) - getPriorityRankValue(b.priority);
    } else {
      delta = (a.createdAt ?? 0) - (b.createdAt ?? 0);
    }
    if (delta === 0) {
      return (a.id - b.id) * multiplier;
    }
    return delta * multiplier;
  });
}

function getPriorityRankValue(priority: ReturnType<typeof deserializeRequest>["priority"]) {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}
