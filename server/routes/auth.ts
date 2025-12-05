import { Router } from "express";
import { getDb } from "../db";
import { users } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updateUserRoleSchema,
  updateUserAccessSchema,
} from "../../shared/api";
import { adminOnly, authMiddleware, type AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function buildAuthPayload(user: typeof users.$inferSelect) {
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isApproved: Boolean(user.isApproved),
      isBlocked: Boolean(user.isBlocked),
    },
  };
}

router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const db = getDb();
    const existingUsers = await db.select().from(users).where(eq(users.email, data.email));
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const requiresApproval = data.role === "rescuer";
    const inserted = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        isApproved: requiresApproval ? false : true,
      })
      .returning();
    const user = inserted[0];
    if (requiresApproval) {
      return res.status(202).json({
        pendingApproval: true,
        message: "Rescuer accounts must be approved by an administrator. We will notify you once access is granted.",
      });
    }
    return res.status(201).json(buildAuthPayload(user));
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const db = getDb();
    const usersResult = await db.select().from(users).where(eq(users.email, data.email));
    if (usersResult.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = usersResult[0];
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    if (user.isBlocked) {
      return res.status(403).json({ error: "Your account access is currently suspended. Contact an administrator." });
    }
    if (user.role === "rescuer" && !user.isApproved) {
      return res.status(403).json({ error: "Your rescuer account is awaiting administrator approval." });
    }
    return res.json(buildAuthPayload(user));
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const db = getDb();
    const userMatches = await db.select().from(users).where(eq(users.email, email));

    // Simulate token issuance for existing accounts
    if (userMatches.length > 0) {
      const resetToken = randomBytes(24).toString("hex");
      console.info(`[forgot-password] Generated reset token for ${email}: ${resetToken}`);
      return res.json({ message: "Password reset instructions sent to your email", resetToken });
    }

    // Avoid leaking which accounts exist
    return res.json({ message: "If that email exists, password reset instructions have been sent" });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    console.error("Forgot password error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    // @ts-ignore - authMiddleware attaches user
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    const u = await db.select().from(users).where(eq(users.id, userId)).get?.();
    if (!u) return res.status(404).json({ error: "Not found" });
    return res.json({ id: u.id, name: u.name, email: u.email, role: u.role, isApproved: Boolean(u.isApproved) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/pending-rescuers", authMiddleware, adminOnly, async (_req, res) => {
  try {
    const db = getDb();
    const pending = await db
      .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.role, "rescuer"), eq(users.isApproved, false), eq(users.isBlocked, false)));
    return res.json(pending);
  } catch (e) {
    console.error("pending-rescuers error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/approve/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const rescuerId = Number(req.params.id);
    if (Number.isNaN(rescuerId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const db = getDb();
    const updated = await db
      .update(users)
      .set({ isApproved: true })
      .where(and(eq(users.id, rescuerId), eq(users.role, "rescuer")))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isApproved: users.isApproved,
        isBlocked: users.isBlocked,
      });
    if (updated.length === 0) {
      return res.status(404).json({ error: "Rescuer not found" });
    }
    return res.json({
      message: "Rescuer approved",
      user: {
        id: updated[0].id,
        name: updated[0].name,
        email: updated[0].email,
        role: updated[0].role,
        isApproved: Boolean(updated[0].isApproved),
        isBlocked: Boolean(updated[0].isBlocked),
      },
    });
  } catch (e) {
    console.error("approve rescuer error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/responders", authMiddleware, adminOnly, async (_req, res) => {
  try {
    const db = getDb();
    const responders = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isApproved: users.isApproved,
        isBlocked: users.isBlocked,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(inArray(users.role, ["rescuer", "admin"]))
      .orderBy(users.createdAt);
    return res.json(
      responders.map((user) => ({
        ...user,
        isApproved: Boolean(user.isApproved),
        isBlocked: Boolean(user.isBlocked),
      })),
    );
  } catch (e) {
    console.error("responders list error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/role", authMiddleware, adminOnly, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const payload = updateUserRoleSchema.parse(req.body);
    const db = getDb();
    const existing = await db.select().from(users).where(eq(users.id, userId)).get?.();
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === payload.role) {
      return res.json({
        message: "Role already set",
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          isApproved: Boolean(existing.isApproved),
          isBlocked: Boolean(existing.isBlocked),
        },
      });
    }

    const updated = await db
      .update(users)
      .set({
        role: payload.role,
        isApproved: true,
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isApproved: users.isApproved,
        isBlocked: users.isBlocked,
      });

    return res.json({
      message: `Role updated to ${payload.role}`,
      user: {
        ...updated[0],
        isApproved: Boolean(updated[0].isApproved),
        isBlocked: Boolean(updated[0].isBlocked),
      },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    console.error("update role error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/access", authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const payload = updateUserAccessSchema.parse(req.body);
    const db = getDb();
    const existing = await db.select().from(users).where(eq(users.id, userId)).get?.();
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }
    if (existing.id === req.user?.userId) {
      return res.status(400).json({ error: "You cannot modify your own access." });
    }

    const [updated] = await db
      .update(users)
      .set({ isBlocked: payload.blocked })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isApproved: users.isApproved,
        isBlocked: users.isBlocked,
      });

    return res.json({
      message: payload.blocked ? "User access blocked" : "User access restored",
      user: {
        ...updated,
        isApproved: Boolean(updated.isApproved),
        isBlocked: Boolean(updated.isBlocked),
      },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    console.error("update access error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
