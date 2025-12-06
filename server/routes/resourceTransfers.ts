import { Router } from "express";
import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { resources, resourceTransfers } from "../db/schema";
import { authMiddleware, rescuerOnly, type AuthRequest } from "../middleware/auth";
import { requirePermission } from "../security/permissions";
import { createResourceTransferSchema } from "../../shared/api";
import { z } from "zod";
import { badRequest, HttpError } from "../utils/httpError";

const router = Router();

router.get("/", authMiddleware, requirePermission("resources:read"), async (_req, res) => {
  const db = getDb();
  const transfers = await db
    .select()
    .from(resourceTransfers)
    .orderBy(desc(resourceTransfers.createdAt))
    .limit(50);
  res.json(transfers);
});

router.post("/", authMiddleware, rescuerOnly, requirePermission("resources:write"), async (req: AuthRequest, res) => {
  try {
    const payload = createResourceTransferSchema.parse(req.body);
    const db = getDb();

    const createdTransfer = await db.transaction(async (tx) => {
      const sourceRows = await tx.select().from(resources).where(eq(resources.id, payload.resourceId));
      const source = sourceRows[0];
      if (!source) throw badRequest("Resource not found");
      if (source.quantity < payload.quantity) throw badRequest("Insufficient stock to transfer");
      if (source.warehouseId === payload.toWarehouseId) throw badRequest("Select a different destination warehouse");

      const timestamp = Date.now();
      await tx
        .update(resources)
        .set({
          quantity: sql`${resources.quantity} - ${payload.quantity}`,
          updatedAt: timestamp,
          version: sql`${resources.version} + 1`,
        })
        .where(eq(resources.id, source.id));

      const existingTarget = await tx
        .select()
        .from(resources)
        .where(and(eq(resources.warehouseId, payload.toWarehouseId), eq(resources.type, source.type)))
        .limit(1);

      if (existingTarget.length > 0) {
        const target = existingTarget[0];
        await tx
          .update(resources)
          .set({
            quantity: sql`${resources.quantity} + ${payload.quantity}`,
            updatedAt: timestamp,
            version: sql`${resources.version} + 1`,
          })
          .where(eq(resources.id, target.id));
      } else {
        await tx.insert(resources).values({
          type: source.type,
          quantity: payload.quantity,
          warehouseId: payload.toWarehouseId,
          unit: source.unit,
          reorderLevel: source.reorderLevel,
        });
      }

      const [transfer] = await tx
        .insert(resourceTransfers)
        .values({
          resourceId: source.id,
          fromWarehouseId: source.warehouseId,
          toWarehouseId: payload.toWarehouseId,
          quantity: payload.quantity,
          note: payload.note ?? null,
          createdBy: req.user?.userId ?? null,
        })
        .returning();

      return transfer;
    });

    res.status(201).json(createdTransfer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid transfer payload", details: error.errors });
    }
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
