import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import { authMiddleware, adminOnly, type AuthRequest } from "../middleware/auth";
import { updateUserProfileSchema } from "../../shared/api";

const router = Router();

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  const requester = req.user!;
  const isSelf = requester.userId === targetId;
  const canView = isSelf || requester.role === "admin" || requester.role === "rescuer";
  if (!canView) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const db = getDb();
  const [record] = await db.select().from(users).where(eq(users.id, targetId));
  if (!record) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!isSelf && requester.role !== "admin" && record.role === "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.json(serializeUser(record));
});

router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const requester = req.user!;
    const isSelf = requester.userId === targetId;
    if (!isSelf && requester.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const payload = updateUserProfileSchema.parse(req.body);
    const db = getDb();
    const [existing] = await db.select().from(users).where(eq(users.id, targetId));
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const updateBody: Partial<typeof users.$inferInsert> = { updatedAt: Date.now() };

    if (payload.name !== undefined) {
      updateBody.name = payload.name;
    }

    if (payload.email !== undefined) {
      const [emailOwner] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, payload.email));
      if (emailOwner && emailOwner.id !== targetId) {
        return res.status(409).json({ error: "Email already in use" });
      }
      updateBody.email = payload.email;
    }

    const adminFieldTouched =
      payload.role !== undefined || payload.isApproved !== undefined || payload.isBlocked !== undefined;

    if (adminFieldTouched && requester.role !== "admin") {
      return res.status(403).json({ error: "Admin privileges required for this update" });
    }

    if (payload.role !== undefined) {
      updateBody.role = payload.role;
    }
    if (payload.isApproved !== undefined) {
      updateBody.isApproved = payload.isApproved;
    }
    if (payload.isBlocked !== undefined) {
      updateBody.isBlocked = payload.isBlocked;
    }

    const [updated] = await db
      .update(users)
      .set(updateBody)
      .where(eq(users.id, targetId))
      .returning();

    return res.json(serializeUser(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid user data", details: error.errors });
    }
    console.error("Failed to update user", error);
    return res.status(500).json({ error: "Unable to update user" });
  }
});

router.delete("/:id", authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (req.user?.userId === targetId) {
    return res.status(400).json({ error: "Administrators cannot delete themselves" });
  }
  const db = getDb();
  const deleted = await db.delete(users).where(eq(users.id, targetId)).returning({ id: users.id });
  if (deleted.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.status(204).send();
});

export default router;

function serializeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isApproved: Boolean(user.isApproved),
    isBlocked: Boolean(user.isBlocked),
    mfaEnabled: Boolean(user.mfaEnabled),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
