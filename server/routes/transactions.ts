import { Router } from "express";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { transactions, rescueRequests, users } from "../db/schema";
import { authMiddleware, adminOnly, rescuerOnly, AuthRequest } from "../middleware/auth";
import { createTransactionSchema } from "../../shared/api";

const router = Router();

router.get("/", authMiddleware, rescuerOnly, async (req, res) => {
  const filters = parseTransactionFilters(req.query as Record<string, unknown>);
  const db = getDb();
  const baseQuery = db
    .select({
      id: transactions.id,
      reference: transactions.reference,
      direction: transactions.direction,
      amountCents: transactions.amountCents,
      currency: transactions.currency,
      category: transactions.category,
      description: transactions.description,
      requestId: transactions.requestId,
      recordedBy: transactions.recordedBy,
      recordedAt: transactions.recordedAt,
      requestCode: rescueRequests.id,
      recorderName: users.name,
    })
    .from(transactions)
    .leftJoin(rescueRequests, eq(rescueRequests.id, transactions.requestId))
    .leftJoin(users, eq(users.id, transactions.recordedBy))
    .orderBy(desc(transactions.recordedAt));

  const whereClause = buildTransactionWhere(filters);
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const limitedQuery = filters.limit ? filteredQuery.limit(filters.limit) : filteredQuery;

  const rows = await limitedQuery;

  res.json(
    rows.map((row) => ({
      ...row,
      description: row.description ?? null,
    })),
  );
});

router.get("/summary", authMiddleware, rescuerOnly, async (req, res) => {
  const summaryOptions = parseTransactionSummaryOptions(req.query as Record<string, unknown>);
  const db = getDb();
  const baseQuery = db
    .select({
      direction: transactions.direction,
      amountCents: transactions.amountCents,
      recordedAt: transactions.recordedAt,
      category: transactions.category,
    })
    .from(transactions);

  const whereClause = buildTransactionWhere(summaryOptions);
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;

  const rows = await filteredQuery;
  let totalIncome = 0;
  let totalExpense = 0;
  const bucketMap = new Map<number, PeriodBucket>();
  const categoryMap = new Map<string, CategoryBreakdown>();

  for (const row of rows) {
    const isIncome = row.direction === "income";
    if (isIncome) totalIncome += row.amountCents;
    else totalExpense += row.amountCents;

    const bucketStart = alignToBucket(row.recordedAt, summaryOptions.bucketSizeMs);
    let bucket = bucketMap.get(bucketStart);
    if (!bucket) {
      bucket = {
        periodStart: bucketStart,
        periodEnd: bucketStart + summaryOptions.bucketSizeMs,
        income: 0,
        expense: 0,
      };
      bucketMap.set(bucketStart, bucket);
    }
    if (isIncome) bucket.income += row.amountCents;
    else bucket.expense += row.amountCents;

    const categoryKey = (row.category ?? "general").toLowerCase();
    let category = categoryMap.get(categoryKey);
    if (!category) {
      category = { category: row.category ?? "general", income: 0, expense: 0 };
      categoryMap.set(categoryKey, category);
    }
    if (isIncome) category.income += row.amountCents;
    else category.expense += row.amountCents;
  }

  const periodBuckets = Array.from(bucketMap.values()).sort((a, b) => a.periodStart - b.periodStart);
  const categories = Array.from(categoryMap.values()).sort(
    (a, b) => b.income + b.expense - (a.income + a.expense),
  );

  res.json({
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    period: summaryOptions.period,
    bucketSizeMs: summaryOptions.bucketSizeMs,
    range: { start: summaryOptions.startMs, end: summaryOptions.endMs },
    periodBuckets,
    categories,
  });
});

router.get("/export", authMiddleware, rescuerOnly, async (req, res) => {
  const filters = parseTransactionFilters(req.query as Record<string, unknown>);
  const db = getDb();
  const baseQuery = db
    .select({
      id: transactions.id,
      reference: transactions.reference,
      direction: transactions.direction,
      amountCents: transactions.amountCents,
      currency: transactions.currency,
      category: transactions.category,
      description: transactions.description,
      requestId: transactions.requestId,
      recordedBy: transactions.recordedBy,
      recordedAt: transactions.recordedAt,
    })
    .from(transactions)
    .orderBy(desc(transactions.recordedAt));

  const whereClause = buildTransactionWhere(filters);
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const exportLimit = filters.limit ?? 2000;
  const rows = await filteredQuery.limit(exportLimit);
  const header = [
    "id",
    "reference",
    "direction",
    "category",
    "amount_cents",
    "amount",
    "currency",
    "recorded_at",
    "recorded_by",
    "request_id",
    "description",
  ];
  const csvRows = rows.map((row) => [
    row.id,
    row.reference,
    row.direction,
    row.category,
    row.amountCents,
    (row.amountCents / 100).toFixed(2),
    row.currency,
    new Date(row.recordedAt).toISOString(),
    row.recordedBy ?? "",
    row.requestId ?? "",
    row.description ?? "",
  ]);

  const csvContent = [header, ...csvRows]
    .map((line) => line.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=transactions_${new Date().toISOString().slice(0, 10)}.csv`,
  );
  res.send(csvContent);
});

router.post("/", authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const payload = createTransactionSchema.parse(req.body);
    const amountCents = Math.round(payload.amount * 100);
    const currency = payload.currency?.toUpperCase() ?? "INR";
    const normalizedCategory = payload.category?.trim().toLowerCase();
    const db = getDb();
    const [record] = await db
      .insert(transactions)
      .values({
        reference: payload.reference,
        direction: payload.direction,
        amountCents,
        currency,
        category: normalizedCategory && normalizedCategory.length ? normalizedCategory : "general",
        description: payload.description,
        requestId: payload.requestId ?? null,
        recordedBy: req.user?.userId ?? null,
      })
      .returning();
    return res.status(201).json(record);
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid transaction data", details: e.issues });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

type TransactionDirection = "income" | "expense";

type TransactionFilterConfig = {
  startMs?: number;
  endMs?: number;
  direction?: TransactionDirection;
  category?: string;
  limit?: number;
};

type PeriodBucket = {
  periodStart: number;
  periodEnd: number;
  income: number;
  expense: number;
};

type CategoryBreakdown = {
  category: string;
  income: number;
  expense: number;
};

type SummaryOptions = TransactionFilterConfig & {
  period: "day" | "week" | "month";
  bucketSizeMs: number;
  startMs: number;
  endMs: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTransactionFilters(query: Record<string, unknown>): TransactionFilterConfig {
  const startMs = parseDateValue(query["start"]);
  const endMs = parseDateValue(query["end"]);
  const direction = parseDirection(query["direction"]);
  const category = normalizeCategory(query["category"]);
  const limit = parsePositiveInt(query["limit"], 1, 5000);
  return {
    startMs,
    endMs,
    direction,
    category,
    limit,
  };
}

function parseTransactionSummaryOptions(query: Record<string, unknown>): SummaryOptions {
  const { limit: _limit, ...filters } = parseTransactionFilters(query);
  const period = parsePeriod(query["period"]);
  const windowDays = parsePositiveInt(query["windowDays"], 1, 365) ?? 30;
  const now = Date.now();
  let startMs = filters.startMs ?? now - windowDays * DAY_MS;
  let endMs = filters.endMs ?? now;
  if (startMs > endMs) {
    [startMs, endMs] = [endMs, startMs];
  }
  return {
    ...filters,
    period,
    bucketSizeMs: bucketSizeForPeriod(period),
    startMs,
    endMs,
  };
}

function buildTransactionWhere(filters: TransactionFilterConfig): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];
  if (filters.startMs) {
    conditions.push(gte(transactions.recordedAt, filters.startMs));
  }
  if (filters.endMs) {
    conditions.push(lte(transactions.recordedAt, filters.endMs));
  }
  if (filters.direction) {
    conditions.push(eq(transactions.direction, filters.direction));
  }
  if (filters.category) {
    conditions.push(eq(transactions.category, filters.category));
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

function parseDirection(value: unknown): TransactionDirection | undefined {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "income" || normalized === "expense") {
    return normalized;
  }
  return undefined;
}

function normalizeCategory(value: unknown): string | undefined {
  const raw = getQueryValue(value)?.trim();
  if (!raw) return undefined;
  return raw.toLowerCase();
}

function parsePositiveInt(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): number | undefined {
  const raw = getQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(Math.max(parsed, min), max);
}

function parsePeriod(value: unknown): "day" | "week" | "month" {
  const normalized = getQueryValue(value)?.toLowerCase();
  if (normalized === "week" || normalized === "month") return normalized;
  return "day";
}

function bucketSizeForPeriod(period: "day" | "week" | "month"): number {
  switch (period) {
    case "week":
      return DAY_MS * 7;
    case "month":
      return DAY_MS * 30;
    default:
      return DAY_MS;
  }
}

function alignToBucket(timestamp: number, bucketSizeMs: number): number {
  return Math.floor(timestamp / bucketSizeMs) * bucketSizeMs;
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

function escapeCsvValue(value: string): string {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
