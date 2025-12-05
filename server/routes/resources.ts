import { Router } from "express";
import { getDb } from "../db";
import { resources } from "../db/schema";
import { authMiddleware, rescuerOnly } from "../middleware/auth";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { updateResourceSchema, createResourceSchema } from "../../shared/api";

const router = Router();

// GET /api/resources - List all resources (Rescuers only)
router.get("/", authMiddleware, rescuerOnly, async (_req, res) => {
  const db = getDb();
  const allResources = await db.select().from(resources).orderBy(desc(resources.updatedAt));
  res.json(allResources);
});

// GET /api/resources/:id - Get single resource (Rescuers only)
router.get("/:id", authMiddleware, rescuerOnly, async (req, res) => {
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
router.post("/", authMiddleware, rescuerOnly, async (req, res) => {
  try {
    const validatedData = createResourceSchema.parse(req.body);
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
    res.status(201).json(newResource);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid resource data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/resources/:id - Update resource (Rescuers only)
router.put("/:id", authMiddleware, rescuerOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid resource ID" });
    }
    const validatedData = updateResourceSchema.parse(req.body);

    const db = getDb();
    const [updatedResource] = await db
      .update(resources)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning();

    if (!updatedResource) {
      return res.status(404).json({ error: "Resource not found" });
    }
    res.json(updatedResource);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/resources/:id - Delete resource (Rescuers only)
router.delete("/:id", authMiddleware, rescuerOnly, async (req, res) => {
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
