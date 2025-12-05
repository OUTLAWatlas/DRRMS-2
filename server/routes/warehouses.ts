import { Router } from "express";
import { getDb } from "../db";
import { warehouses, resources } from "../db/schema";
import { authMiddleware, rescuerOnly } from "../middleware/auth";
import { eq, desc } from "drizzle-orm";
import { createResourceSchema, createWarehouseSchema, updateWarehouseSchema } from "../../shared/api";
import { z } from "zod";
import { requirePermission } from "../security/permissions";

const router = Router();
const warehouseResourceSchema = createResourceSchema.omit({ warehouseId: true });

// GET /api/warehouses - List all
router.get("/", authMiddleware, requirePermission("warehouses:read"), async (_req, res) => {
  const db = getDb();
  const all = await db.select().from(warehouses).orderBy(desc(warehouses.createdAt));
  res.json(all);
});

// POST /api/warehouses - Create warehouse
router.post("/", authMiddleware, rescuerOnly, requirePermission("warehouses:write"), async (req, res) => {
  try {
    const data = createWarehouseSchema.parse(req.body);
    const db = getDb();
    const [created] = await db
      .insert(warehouses)
      .values({
        name: data.name,
        location: data.location,
        capacity: data.capacity ?? 0,
        lastAuditedAt: toMillis(data.lastAuditedAt),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      })
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
router.get("/:id", authMiddleware, requirePermission("warehouses:read"), async (req, res) => {
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

// PUT /api/warehouses/:id - Update warehouse metadata
router.put("/:id", authMiddleware, rescuerOnly, requirePermission("warehouses:write"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid warehouse ID" });

    const validated = updateWarehouseSchema.parse(req.body);
    const updatePayload: Record<string, unknown> = {};
    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.location !== undefined) updatePayload.location = validated.location;
    if (validated.capacity !== undefined) updatePayload.capacity = validated.capacity;
    if (validated.lastAuditedAt !== undefined) {
      updatePayload.lastAuditedAt = toMillis(validated.lastAuditedAt);
    }
    if (validated.latitude !== undefined) updatePayload.latitude = validated.latitude;
    if (validated.longitude !== undefined) updatePayload.longitude = validated.longitude;
    updatePayload.updatedAt = Date.now();

    if (Object.keys(updatePayload).length === 1 && "updatedAt" in updatePayload) {
      return res.status(400).json({ error: "No updates provided" });
    }

    const db = getDb();
    const [updated] = await db
      .update(warehouses)
      .set(updatePayload)
      .where(eq(warehouses.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Warehouse not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid warehouse update", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/warehouses/:id/inventory - Get inventory
router.get("/:id/inventory", authMiddleware, requirePermission("warehouses:read"), async (req, res) => {
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

router.post(
  "/:id/resources",
  authMiddleware,
  rescuerOnly,
  requirePermission("resources:write"),
  async (req, res) => {
    try {
      const warehouseId = parseInt(req.params.id);
      if (isNaN(warehouseId)) {
        return res.status(400).json({ error: "Invalid warehouse ID" });
      }

      const payload = warehouseResourceSchema.parse(req.body);
      const db = getDb();
      const warehouseExists = await db.select({ id: warehouses.id }).from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
      if (warehouseExists.length === 0) {
        return res.status(404).json({ error: "Warehouse not found" });
      }

      const [created] = await db
        .insert(resources)
        .values({
          warehouseId,
          type: payload.type,
          quantity: payload.quantity,
          unit: payload.unit ?? "units",
          reorderLevel: payload.reorderLevel ?? 0,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid resource data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;

function toMillis(value?: string | number | null) {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
