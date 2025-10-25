import { Router } from "express";
import { getDb } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "../../shared/api";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, data.email)).get?.();
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const inserted = await db
      .insert(users)
      .values({ name: data.name, email: data.email, passwordHash, role: data.role })
      .returning();
    const user = inserted[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
  const db = getDb();
  const user = await db.select().from(users).where(eq(users.email, data.email)).get?.();
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
