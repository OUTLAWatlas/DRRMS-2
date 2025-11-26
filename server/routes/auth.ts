import { Router } from "express";
import { getDb } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "../../shared/api";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const db = getDb();
    const existingUsers = await db.select().from(users).where(eq(users.email, data.email));
    if (existingUsers.length > 0) {
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
    console.log("Login attempt:", req.body);
    const data = loginSchema.parse(req.body);
    console.log("Parsed data:", data);
    const db = getDb();
    console.log("Got DB connection");
    const users_result = await db.select().from(users).where(eq(users.email, data.email));
    console.log("Query result:", users_result);
    if (users_result.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = users_result[0];
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    console.log("Password check:", ok);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e: any) {
    console.error("Login error:", e);
    if (e?.issues) return res.status(400).json({ error: "Invalid data", details: e.issues });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

router.get("/me", authMiddleware, async (req, res) => {
  try {
    // @ts-ignore - authMiddleware attaches user
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    const u = await db.select().from(users).where(eq(users.id, userId)).get?.();
    if (!u) return res.status(404).json({ error: "Not found" });
    return res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
});
