import { Router } from "express";
import { getDb } from "../db";
import { disasterReports } from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createReportSchema, updateReportSchema } from "../../shared/api";
import { decryptField, encryptField } from "../security/encryption";
import { requirePermission } from "../security/permissions";

const router = Router();

const reportSchema = createReportSchema;

// POST /api/reports - Create
router.post("/", authMiddleware, requirePermission("reports:create"), async (req: AuthRequest, res) => {
  try {
    const data = reportSchema.parse(req.body);
    const db = getDb();
    const [report] = await db
      .insert(disasterReports)
      .values({
        whatHappened: encryptField(data.whatHappened),
        location: encryptField(data.location),
        severity: data.severity,
        occurredAt: parseDateInput(data.occurredAt),
        userId: req.user?.userId,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      .returning();
    res.status(201).json(deserializeReport(report));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid report data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports - List all (Rescuers only)
router.get("/", authMiddleware, rescuerOnly, requirePermission("reports:read"), async (req, res) => {
  const db = getDb();
  const filters = parseReportListFilters(req.query as Record<string, unknown>);
  const whereClause = buildReportWhere(filters);

  const baseQuery = db.select().from(disasterReports).orderBy(desc(disasterReports.createdAt));
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const limitedQuery = filters.limit ? filteredQuery.limit(filters.limit) : filteredQuery;
  const paginatedQuery = filters.limit && filters.page ? limitedQuery.offset((filters.page - 1) * filters.limit) : limitedQuery;

  const rows = await paginatedQuery;
  const payload = rows.map(deserializeReport);

  if (filters.page && filters.limit) {
    const total = await countReports(db, whereClause);
    const totalPages = Math.max(1, Math.ceil(total / filters.limit));
    return res.json({
      reports: payload,
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

// GET /api/reports/:id - Get single
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid report ID" });
  const db = getDb();
  const rows = await db.select().from(disasterReports).where(eq(disasterReports.id, id));
    const report = rows[0];
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(deserializeReport(report));
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/reports/:id - Update report (Rescuers only)
router.put("/:id", authMiddleware, rescuerOnly, requirePermission("reports:update"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid report ID" });
    }
    const validatedData = updateReportSchema.parse(req.body);

    const db = getDb();
    const [updated] = await db
      .update(disasterReports)
      .set({
        ...validatedData,
        occurredAt: parseDateInput(validatedData.occurredAt),
        updatedAt: Date.now(),
        whatHappened: validatedData.whatHappened ? encryptField(validatedData.whatHappened) : undefined,
        location: validatedData.location ? encryptField(validatedData.location) : undefined,
      })
      .where(eq(disasterReports.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(deserializeReport(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/reports/:id - Delete report (Rescuers only)
router.delete("/:id", authMiddleware, rescuerOnly, requirePermission("reports:delete"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid report ID" });
    }

  const db = getDb();
  const deleted = await db.delete(disasterReports).where(eq(disasterReports.id, id)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.status(204).send();
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

function deserializeReport(report: typeof disasterReports.$inferSelect) {
  return {
    ...report,
    whatHappened: decryptField(report.whatHappened),
    location: decryptField(report.location),
  };
}

function parseDateInput(value?: string | null) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type ReportListFilters = {
  status?: "pending" | "in_progress" | "resolved" | "rejected";
  severity?: "Low" | "Moderate" | "High" | "Critical";
  page?: number;
  limit?: number;
};

function parseReportListFilters(query: Record<string, unknown>): ReportListFilters {
  const status = parseStatus(query["status"]);
  const severity = parseSeverity(query["severity"]);
  const page = parsePositiveInt(query["page"], 1, 10_000);
  let limit = parsePositiveInt(query["limit"], 1, 200) ?? undefined;

  if (page && !limit) {
    limit = 10;
  }

  return { status, severity, page, limit };
}

function buildReportWhere(filters: ReportListFilters): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];
  if (filters.status) {
    conditions.push(eq(disasterReports.status, filters.status));
  }
  if (filters.severity) {
    conditions.push(eq(disasterReports.severity, filters.severity));
  }
  if (!conditions.length) return undefined;
  return conditions.reduce<SQL<unknown> | undefined>((acc, condition) => (acc ? and(acc, condition) : condition), undefined);
}

async function countReports(
  db: Awaited<ReturnType<typeof getDb>>,
  whereClause: SQL<unknown> | undefined,
): Promise<number> {
  const countQuery = db.select({ value: sql<number>`count(*)` }).from(disasterReports);
  const finalQuery = whereClause ? countQuery.where(whereClause) : countQuery;
  const result = await finalQuery;
  return Number(result[0]?.value ?? 0);
}

function parsePositiveInt(value: unknown, min: number, max: number): number | undefined {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return undefined;
  const clamped = Math.min(Math.max(parsed, min), max);
  return clamped;
}

function parseStatus(value: unknown) {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "pending" || normalized === "in_progress" || normalized === "resolved" || normalized === "rejected") {
    return normalized as ReportListFilters["status"];
  }
  return undefined;
}

function parseSeverity(value: unknown) {
  const normalized = getQueryValue(value)?.toLowerCase();
  switch (normalized) {
    case "low":
      return "Low";
    case "moderate":
      return "Moderate";
    case "high":
      return "High";
    case "critical":
      return "Critical";
    default:
      return undefined;
  }
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
