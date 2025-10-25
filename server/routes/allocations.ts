import { Router } from "express";
import { getDb } from "../db";
import { resourceAllocations, resources, rescueRequests } from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { createAllocationSchema } from "../../shared/api";

const router = Router();

// POST /api/allocations - Allocate resources (Rescuers only)
router.post("/", authMiddleware, rescuerOnly, async (req: AuthRequest, res) => {
  try {
    const validatedData = createAllocationSchema.parse(req.body);
    const { requestId, resources: requestedResources } = validatedData;

    // Basic checks
  const db = getDb();
  const reqRows = await db.select().from(rescueRequests).where(eq(rescueRequests.id, requestId));
    if (reqRows.length === 0) return res.status(400).json({ error: "Rescue request does not exist" });

    // Transaction to ensure atomicity
  await getDb().transaction(async (tx) => {
      for (const resReq of requestedResources) {
        // 1. Check if sufficient resource quantity exists
        const rows = await tx.select({ quantity: resources.quantity }).from(resources).where(eq(resources.id, resReq.resourceId));
        const current = rows[0];
        if (!current || (current.quantity ?? 0) < resReq.quantity) {
          throw new Error(`Insufficient quantity for resource ID ${resReq.resourceId}`);
        }

        // 2. Insert allocation record
        await tx.insert(resourceAllocations).values({
          requestId: requestId,
          resourceId: resReq.resourceId,
          quantity: resReq.quantity,
          allocatedBy: req.user!.userId,
        });

        // 3. Decrement resource quantity
        await tx
          .update(resources)
          .set({ quantity: sql`${resources.quantity} - ${resReq.quantity}` })
          .where(eq(resources.id, resReq.resourceId));
      }
    });

    res.status(201).json({ message: "Resources allocated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid allocation data", details: error.errors });
    }
    console.error("Allocation failed:", error);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Allocation failed" });
  }
});

// GET /api/allocations - List all allocations (Rescuers only)
router.get("/", authMiddleware, rescuerOnly, async (_req, res) => {
  const db = getDb();
  const allocations = await db
    .select()
    .from(resourceAllocations)
    .orderBy(desc(resourceAllocations.allocatedAt));
  res.json(allocations);
});

// GET /api/allocations/:id - Get single allocation (Rescuers only)
router.get("/:id", authMiddleware, rescuerOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid allocation ID" });
    }
  const db = getDb();
  const rows = await db.select().from(resourceAllocations).where(eq(resourceAllocations.id, id));
    const allocation = rows[0];
    if (!allocation) {
      return res.status(404).json({ error: "Allocation not found" });
    }
    res.json(allocation);
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
