import { Router } from "express";
import { getDb } from "../db";
import { warehouses, resources } from "../db/schema";
import { authMiddleware, rescuerOnly } from "../middleware/auth";
import { eq, desc } from "drizzle-orm";
import { createWarehouseSchema } from "../../shared/api";
import { z } from "zod";

const router = Router();

// GET /api/warehouses - List all
router.get("/", authMiddleware, async (_req, res) => {
  const db = getDb();
  const all = await db.select().from(warehouses).orderBy(desc(warehouses.createdAt));
  res.json(all);
});

// POST /api/warehouses - Create warehouse
router.post("/", authMiddleware, rescuerOnly, async (req, res) => {
  try {
    const data = createWarehouseSchema.parse(req.body);
    const db = getDb();
    const [created] = await db
      .insert(warehouses)
      .values({ name: data.name, location: data.location })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid warehouse data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/warehouses/:id - Get warehouse details
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid warehouse ID" });
  const db = getDb();
  const rows = await db.select().from(warehouses).where(eq(warehouses.id, id));
    const warehouse = rows[0];
    if (!warehouse) return res.status(404).json({ error: "Warehouse not found" });
    res.json(warehouse);
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/warehouses/:id/inventory - Get inventory
router.get("/:id/inventory", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid warehouse ID" });
  const db = getDb();
  const items = await db.select().from(resources).where(eq(resources.warehouseId, id));
    res.json(items);
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
