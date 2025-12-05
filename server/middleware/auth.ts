import type { Request, Response, NextFunction } from "express";
import { users } from "../db/schema";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { verifyAuthToken } from "../security/jwt";

export interface AuthUser {
  userId: number;
  role: "survivor" | "rescuer" | "admin";
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = auth.slice("Bearer ".length).trim();
    const payload = verifyAuthToken(token);
    if (!payload?.userId || !payload?.role) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function rescuerOnly(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role === "rescuer" || role === "admin") return next();
  return res.status(403).json({ error: "Forbidden" });
}

export async function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ error: "Forbidden" });
}

export async function loadUser(req: AuthRequest, _res: Response, next: NextFunction) {
  // Optional middleware to load full user record if needed
  if (!req.user) return next();
  const db = getDb();
  const user = await db.select().from(users).where(eq(users.id, req.user.userId)).get?.();
  // Not strictly used in this implementation; kept for possible future enrichment
  return next();
}
