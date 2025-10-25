import { Router } from "express";
import { getDb } from "../db";
import { disasterReports } from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createReportSchema, updateReportSchema } from "../../shared/api";

const router = Router();

const reportSchema = createReportSchema;

// POST /api/reports - Create
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = reportSchema.parse(req.body);
    const db = getDb();
    const [report] = await db
      .insert(disasterReports)
      .values({
        whatHappened: data.whatHappened,
        location: data.location,
        severity: data.severity,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined,
        userId: req.user?.userId,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      .returning();
    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid report data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports - List all (Rescuers only)
router.get("/", authMiddleware, rescuerOnly, async (_req, res) => {
  const db = getDb();
  const all = await db.select().from(disasterReports).orderBy(desc(disasterReports.createdAt));
  res.json(all);
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
    res.json(report);
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/reports/:id - Update report (Rescuers only)
router.put("/:id", authMiddleware, rescuerOnly, async (req, res) => {
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
        occurredAt: validatedData.occurredAt ? new Date(validatedData.occurredAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/reports/:id - Delete report (Rescuers only)
router.delete("/:id", authMiddleware, rescuerOnly, async (req, res) => {
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
