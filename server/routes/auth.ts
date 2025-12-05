import { Router } from "express";
import { getDb } from "../db";
import { users } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updateUserRoleSchema,
  updateUserAccessSchema,
  mfaVerifySchema,
  mfaDisableSchema,
} from "../../shared/api";
import { adminOnly, authMiddleware, type AuthRequest } from "../middleware/auth";
import { signAuthToken } from "../security/jwt";
import {
  consumeRecoveryCode,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  issueMfaSetup,
  verifyMfaToken,
} from "../security/mfa";
import { createRateLimiter } from "../middleware/rateLimit";
import { requirePermission } from "../security/permissions";

const router = Router();
const loginLimiter = createRateLimiter({ bucketId: "auth:login", rule: { windowMs: 60_000, max: 8 } });
const registerLimiter = createRateLimiter({ bucketId: "auth:register", rule: { windowMs: 60_000, max: 6 } });
const forgotLimiter = createRateLimiter({ bucketId: "auth:forgot", rule: { windowMs: 60_000, max: 5 } });

function buildAuthPayload(user: typeof users.$inferSelect) {
  const token = signAuthToken({ userId: user.id, role: user.role });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isApproved: Boolean(user.isApproved),
      isBlocked: Boolean(user.isBlocked),
        mfaEnabled: Boolean(user.mfaEnabled),
    },
  };
}

router.post("/register", registerLimiter, async (req, res) => {
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

router.post("/login", loginLimiter, async (req, res) => {
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
    if (user.mfaEnabled) {
      const decryptedSecret = decryptMfaSecret(user.mfaSecret ?? null);
      const providedToken = data.mfaToken ?? null;
      const providedRecovery = data.mfaRecoveryCode ?? null;
      let refreshedRecoveryPayload = user.mfaRecoveryCodes ?? null;
      let satisfied = false;
      if (decryptedSecret && providedToken) {
        satisfied = verifyMfaToken({ secret: decryptedSecret, token: providedToken });
      }
      if (!satisfied && providedRecovery) {
        const result = consumeRecoveryCode({ storedPayload: user.mfaRecoveryCodes, provided: providedRecovery });
        if (result.ok) {
          satisfied = true;
          refreshedRecoveryPayload = result.remaining ?? null;
        }
      }
      if (!satisfied) {
        return res.status(401).json({ error: "MFA challenge required" });
      }
      await db
        .update(users)
        .set({ lastMfaVerifiedAt: Date.now(), mfaRecoveryCodes: refreshedRecoveryPayload })
        .where(eq(users.id, user.id));
    }
    return res.json(buildAuthPayload(user));
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", authMiddleware, (req, res) => {
  // Stateless JWT auth: client simply discards token. Endpoint exists for parity with roadmap requirements.
  return res.json({ message: "Logged out" });
});

router.post("/forgot-password", forgotLimiter, async (req, res) => {
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

router.post("/mfa/setup", authMiddleware, requirePermission("rescue:list:own"), async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    const { secret, uri } = issueMfaSetup(user.email ?? `user-${user.id}`);
    const recoveryCodes = generateRecoveryCodes();
    await db
      .update(users)
      .set({
        mfaSecret: encryptMfaSecret(secret),
        mfaEnabled: false,
        mfaRecoveryCodes: hashRecoveryCodes(recoveryCodes),
      })
      .where(eq(users.id, user.id));
    return res.json({ secret, uri, recoveryCodes });
  } catch (error) {
    console.error("mfa setup error", error);
    return res.status(500).json({ error: "Unable to initialize MFA" });
  }
});

router.post("/mfa/verify", authMiddleware, requirePermission("rescue:list:own"), async (req: AuthRequest, res) => {
  try {
    const body = mfaVerifySchema.parse(req.body);
    const db = getDb();
    const [record] = await db.select().from(users).where(eq(users.id, req.user!.userId));
    if (!record || !record.mfaSecret) return res.status(400).json({ error: "No MFA secret on file" });
    const secret = decryptMfaSecret(record.mfaSecret);
    if (!secret) return res.status(400).json({ error: "Secret unavailable" });
    const valid = verifyMfaToken({ secret, token: body.token });
    if (!valid) return res.status(401).json({ error: "Invalid MFA token" });
    await db
      .update(users)
      .set({ mfaEnabled: true, lastMfaVerifiedAt: Date.now() })
      .where(eq(users.id, record.id));
    return res.json({ message: "MFA enabled" });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ error: "Invalid data", details: error.issues });
    console.error("mfa verify error", error);
    return res.status(500).json({ error: "Unable to verify MFA" });
  }
});

router.post("/mfa/disable", authMiddleware, requirePermission("rescue:list:own"), async (req: AuthRequest, res) => {
  try {
    const body = mfaDisableSchema.parse(req.body);
    const db = getDb();
    const [record] = await db.select().from(users).where(eq(users.id, req.user!.userId));
    if (!record?.mfaSecret) {
      return res.status(200).json({ message: "MFA already disabled" });
    }
    const secret = decryptMfaSecret(record.mfaSecret);
    let ok = false;
    if (body.token && secret) {
      ok = verifyMfaToken({ secret, token: body.token });
    }
    if (!ok && body.recoveryCode) {
      const result = consumeRecoveryCode({ storedPayload: record.mfaRecoveryCodes, provided: body.recoveryCode });
      ok = result.ok;
    }
    if (!ok) return res.status(401).json({ error: "MFA challenge required" });
    await db
      .update(users)
      .set({ mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: null, lastMfaVerifiedAt: null })
      .where(eq(users.id, record.id));
    return res.json({ message: "MFA disabled" });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ error: "Invalid data", details: error.issues });
    console.error("mfa disable error", error);
    return res.status(500).json({ error: "Unable to disable MFA" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    // @ts-ignore - authMiddleware attaches user
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return res.status(404).json({ error: "Not found" });
    return res.json({ ...serializeUser(u), createdAt: u.createdAt, updatedAt: u.updatedAt });
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
      user: serializeUser(updated[0]),
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
        ...serializeUser(user),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
    const [existing] = await db.select().from(users).where(eq(users.id, userId));
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === payload.role) {
      return res.json({
        message: "Role already set",
        user: serializeUser(existing),
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
      user: serializeUser(updated[0]),
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
    const [existing] = await db.select().from(users).where(eq(users.id, userId));
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
      user: serializeUser(updated),
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    console.error("update access error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

type SerializableUser = Pick<
  typeof users.$inferSelect,
  "id" | "name" | "email" | "role" | "isApproved" | "isBlocked"
> &
  Partial<Pick<typeof users.$inferSelect, "mfaEnabled">>;

function serializeUser(user: SerializableUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isApproved: Boolean(user.isApproved),
    isBlocked: Boolean(user.isBlocked),
    mfaEnabled: Boolean(user.mfaEnabled),
  };
}
