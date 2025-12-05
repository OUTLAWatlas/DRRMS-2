import { desc, gte, sql } from "drizzle-orm";
import { createHash, createHmac } from "crypto";
import { getDb } from "../db";
import {
  disasterReports,
  rescueRequests,
  resources,
  transactions,
  transparencyReports,
  users,
  warehouses,
} from "../db/schema";
import { appendLedgerEntry } from "./transparency-ledger";

const BUCKET_MINUTES = Number(process.env.TRANSPARENCY_BUCKET_MINUTES ?? 60);
const SIGNING_SECRET = process.env.TRANSPARENCY_SIGNING_SECRET || process.env.JWT_SECRET || "drrms-sign";

export async function generateTransparencyReport(now = Date.now()) {
  const db = getDb();
  const bucketMs = Math.max(5, BUCKET_MINUTES) * 60 * 1000;
  const bucketStart = Math.floor(now / bucketMs) * bucketMs;
  const bucketEnd = bucketStart + bucketMs;
  const windowStart = now - 24 * 60 * 60 * 1000;

  const [{ count: rescueTotal }] = await db.select({ count: sql<number>`count(*)::int` }).from(rescueRequests);
  const [{ count: reportTotal }] = await db.select({ count: sql<number>`count(*)::int` }).from(disasterReports);
  const [{ count: warehouseTotal }] = await db.select({ count: sql<number>`count(*)::int` }).from(warehouses);
  const [{ count: resourceTotal }] = await db.select({ count: sql<number>`count(*)::int` }).from(resources);

  const [statusCounts] = await db
    .select({
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      fulfilled: sql<number>`count(*) filter (where status = 'fulfilled')::int`,
    })
    .from(rescueRequests);

  const [{ count: newRequests }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rescueRequests)
    .where(gte(rescueRequests.createdAt, windowStart));

  const [{ count: newReports }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(disasterReports)
    .where(gte(disasterReports.createdAt, windowStart));

  const [financeRows] = await db
    .select({
      income: sql<number>`coalesce(sum(amount_cents) filter (where direction = 'income'),0)` ,
      expense: sql<number>`coalesce(sum(amount_cents) filter (where direction = 'expense'),0)` ,
    })
    .from(transactions)
    .where(gte(transactions.recordedAt, windowStart));

  const [governance] = await db
    .select({
      pendingApprovals: sql<number>`count(*) filter (where role = 'rescuer' and is_approved = false)::int`,
      blockedUsers: sql<number>`count(*) filter (where is_blocked = true)::int`,
    })
    .from(users);

  const [latest] = await db.select().from(transparencyReports).orderBy(desc(transparencyReports.bucketStart)).limit(1);

  const payload = {
    generatedAt: now,
    windowStart,
    bucketStart,
    bucketEnd,
    totals: {
      rescueRequests: rescueTotal,
      disasterReports: reportTotal,
      warehouses: warehouseTotal,
      resources: resourceTotal,
    },
    activity24h: {
      newRequests,
      newReports,
      incomeCents: Number(financeRows?.income ?? 0),
      expenseCents: Number(financeRows?.expense ?? 0),
    },
    status: {
      pending: statusCounts?.pending ?? 0,
      inProgress: statusCounts?.inProgress ?? 0,
      fulfilled: statusCounts?.fulfilled ?? 0,
    },
    governance: {
      pendingApprovals: governance?.pendingApprovals ?? 0,
      blockedUsers: governance?.blockedUsers ?? 0,
    },
    chain: {
      previousHash: latest?.payloadHash ?? null,
    },
  };

  const payloadString = JSON.stringify(payload);
  const hash = createHash("sha256").update(payloadString).digest("hex");
  const signature = createHmac("sha256", SIGNING_SECRET).update(hash).digest("hex");

  const [record] = await db
    .insert(transparencyReports)
    .values({
      bucketStart,
      bucketEnd,
      payload: payloadString,
      payloadHash: hash,
      signature,
      metadata: JSON.stringify({ version: 1 }),
    })
    .onConflictDoUpdate({
      target: transparencyReports.bucketStart,
      set: {
        bucketEnd,
        payload: payloadString,
        payloadHash: hash,
        signature,
        metadata: JSON.stringify({ version: 1 }),
      },
    })
    .returning({ id: transparencyReports.id });

  await appendLedgerEntry({
    entryType: "transparency_report",
    payload: {
      reportId: record?.id ?? null,
      bucketStart,
      bucketEnd,
      payloadHash: hash,
    },
    metadata: {
      reportId: record?.id ?? null,
      bucketStart,
      bucketEnd,
    },
  });

  return { bucketStart, bucketEnd, hash };
}
