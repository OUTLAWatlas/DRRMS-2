import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { appendTransparencyLedgerEntrySchema } from "@shared/api";
import { getDb } from "../db";
import { transparencyReports } from "../db/schema";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { requirePermission } from "../security/permissions";
import { generateTransparencyReport } from "../services/transparency-report";
import { appendLedgerEntry, getLedgerEntries } from "../services/transparency-ledger";

const router = Router();

router.get("/", authMiddleware, requirePermission("transparency:read"), async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit ?? 20));
  const db = getDb();
  const rows = await db.select().from(transparencyReports).orderBy(desc(transparencyReports.bucketStart)).limit(limit);
  res.json(rows.map(hydratePayload));
});

router.get("/:id", authMiddleware, requirePermission("transparency:read"), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid report id" });
  }
  const db = getDb();
  const rows = await db.select().from(transparencyReports).where(eq(transparencyReports.id, id));
  const report = rows[0];
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(hydratePayload(report));
});

router.post("/run", authMiddleware, requirePermission("transparency:generate"), async (_req: AuthRequest, res) => {
  try {
    const result = await generateTransparencyReport();
    res.json({ message: "Transparency report generated", result });
  } catch (error) {
    console.error("transparency run failed", error);
    res.status(500).json({ error: "Unable to generate report" });
  }
});

router.get("/ledger", authMiddleware, requirePermission("transparency:read"), async (req, res) => {
  const rawLimit = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  const entries = await getLedgerEntries(limit);
  res.json({ entries, latestHash: entries[0]?.entryHash ?? null });
});

router.post("/ledger", authMiddleware, requirePermission("transparency:generate"), async (req: AuthRequest, res) => {
  const payload = appendTransparencyLedgerEntrySchema.parse(req.body);
  const entry = await appendLedgerEntry({
    entryType: payload.entryType,
    payload: payload.payload ?? {},
    metadata: payload.metadata ?? null,
    actorId: req.user?.userId ?? null,
  });
  res.status(201).json({ message: "Ledger entry appended", entry });
});

export default router;

function hydratePayload(row: typeof transparencyReports.$inferSelect) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.payload ?? "null");
  } catch (_e) {
    parsed = null;
  }
  return {
    ...row,
    payload: parsed,
  };
}
