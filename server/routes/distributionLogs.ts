import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { distributionLogs, resources } from "../db/schema";
import { authMiddleware, rescuerOnly, type AuthRequest } from "../middleware/auth";
import { requirePermission } from "../security/permissions";
import { createDistributionLogSchema } from "../../shared/api";
import { badRequest, HttpError } from "../utils/httpError";

const router = Router();

router.get("/", authMiddleware, requirePermission("resources:read"), async (_req, res) => {
  const db = getDb();
  const logs = await db
    .select()
    .from(distributionLogs)
    .orderBy(desc(distributionLogs.createdAt))
    .limit(50);
  res.json(logs);
});

router.post(
  "/",
  authMiddleware,
  rescuerOnly,
  requirePermission("distribution:write"),
  async (req: AuthRequest, res) => {
  try {
    const payload = createDistributionLogSchema.parse(req.body);
    const db = getDb();

    const createdLog = await db.transaction(async (tx) => {
      const resourceRows = await tx.select().from(resources).where(eq(resources.id, payload.resourceId));
      const resource = resourceRows[0];
      if (!resource) throw badRequest("Resource not found");
      if (resource.warehouseId !== payload.warehouseId)
        throw badRequest("Resource does not belong to the provided warehouse");
      if (resource.quantity < payload.quantity) throw badRequest("Insufficient stock to dispatch");

      const timestamp = Date.now();
      await tx
        .update(resources)
        .set({
          quantity: sql`${resources.quantity} - ${payload.quantity}`,
          updatedAt: timestamp,
          version: sql`${resources.version} + 1`,
        })
        .where(eq(resources.id, resource.id));

      const [log] = await tx
        .insert(distributionLogs)
        .values({
          resourceId: payload.resourceId,
          warehouseId: payload.warehouseId,
          quantity: payload.quantity,
          destination: payload.destination,
          requestId: payload.requestId ?? null,
          notes: payload.notes ?? null,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          createdBy: req.user?.userId ?? null,
        })
        .returning();

      return log;
    });

      res.status(201).json(createdLog);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid distribution payload", details: error.errors });
      }
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
