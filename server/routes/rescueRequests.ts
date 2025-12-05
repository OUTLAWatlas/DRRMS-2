import { Router } from "express";
import { getDb } from "../db";
import { rescueRequests } from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createRescueRequestSchema, updateRescueRequestStatusSchema } from "../../shared/api";
import { encryptField, decryptField } from "../security/encryption";
import { hashSensitiveValue } from "../security/hash";
import { requirePermission } from "../security/permissions";

const router = Router();

// POST /api/rescue-requests - Create
router.post("/", authMiddleware, requirePermission("rescue:create"), async (req: AuthRequest, res) => {
  try {
    const data = createRescueRequestSchema.parse(req.body);
    const db = getDb();
    const [created] = await db
      .insert(rescueRequests)
      .values({
        userId: req.user?.userId,
        location: data.location,
        details: encryptField(data.details)!,
        detailsDigest: hashSensitiveValue(data.details),
        peopleCount: data.peopleCount,
        priority: data.priority,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      })
      .returning();
    res.status(201).json(deserializeRequest(created));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/rescue-requests - List
router.get("/", authMiddleware, requirePermission("rescue:list:own"), async (req: AuthRequest, res) => {
  const role = req.user?.role;
  if (role === "rescuer" || role === "admin") {
    const db = getDb();
    const all = await db.select().from(rescueRequests).orderBy(desc(rescueRequests.createdAt));
    return res.json(all.map(deserializeRequest));
  }
  // survivors: only their own
  const db = getDb();
  const own = await db
    .select()
    .from(rescueRequests)
    .where(eq(rescueRequests.userId, req.user!.userId))
    .orderBy(desc(rescueRequests.createdAt));
  return res.json(own.map(deserializeRequest));
});

// GET /api/rescue-requests/:id - Get single request
router.get("/:id", authMiddleware, requirePermission("rescue:list:own"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }
  const db = getDb();
  const rows = await db.select().from(rescueRequests).where(eq(rescueRequests.id, id));
    const request = rows[0];
    if (!request) {
      return res.status(404).json({ error: "Rescue request not found" });
    }
    if (req.user?.role === "survivor" && request.userId !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(deserializeRequest(request));
  } catch (_e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/rescue-requests/:id - Update status
router.put("/:id", authMiddleware, rescuerOnly, requirePermission("rescue:update"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }
    const data = updateRescueRequestStatusSchema.parse(req.body);
    const db = getDb();
    const [updated] = await db
      .update(rescueRequests)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(rescueRequests.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Rescue request not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

function deserializeRequest(request: typeof rescueRequests.$inferSelect) {
  const { detailsDigest, ...rest } = request;
  return {
    ...rest,
    details: decryptField(request.details),
  };
}
