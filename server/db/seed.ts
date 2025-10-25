import bcrypt from "bcryptjs";
import { getDbAsync } from "./index";
import { users, warehouses, resources } from "./schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception during seeding:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection during seeding:", reason);
});

async function seedDatabase() {
  console.log("Starting database seed...");
  try {
    const db = await getDbAsync();

  try {
    console.log("Seeding users...");
    const email = "rescuer@drrms.org";
    const existingUsers = await db.select().from(users).where(eq(users.email, email));
    let rescuerId: number;
    if (existingUsers.length === 0) {
      const passwordHash = await bcrypt.hash("password123", 10);
      const [inserted] = await db
        .insert(users)
        .values({
          name: "Default Rescuer",
          email,
          passwordHash,
          role: "rescuer",
        })
        .returning();
      rescuerId = inserted.id as number;
      console.log(`Created rescuer user with id=${rescuerId}`);
    } else {
      rescuerId = existingUsers[0].id as number;
      console.log(`Rescuer user already exists id=${rescuerId}`);
    }

    console.log("Seeding warehouses...");
    const warehouseName = "Mumbai Central Warehouse";
    const existingWhs = await db
      .select()
      .from(warehouses)
      .where(eq(warehouses.name, warehouseName));
    let warehouseId: number;
    if (existingWhs.length === 0) {
      const [wh] = await db
        .insert(warehouses)
        .values({ name: warehouseName, location: "Mumbai, India" })
        .returning();
      warehouseId = wh.id as number;
      console.log(`Created warehouse id=${warehouseId}`);
    } else {
      warehouseId = existingWhs[0].id as number;
      console.log(`Warehouse already exists id=${warehouseId}`);
    }

    console.log("Seeding resources...");
    const seedResources = [
      { type: "Water", quantity: 100 },
      { type: "Food", quantity: 500 },
      { type: "Medical Kits", quantity: 200 },
      { type: "Blankets", quantity: 400 },
      { type: "Fuel", quantity: 60 },
    ];

    for (const r of seedResources) {
      const existing = await db
        .select()
        .from(resources)
        .where(eq(resources.warehouseId, warehouseId));
      const already = existing.find((e) => e.type === r.type);
      if (already) {
        console.log(`Resource '${r.type}' already exists (id=${already.id})`);
        continue;
      }
      const [resRow] = await db
        .insert(resources)
        .values({ type: r.type, quantity: r.quantity, warehouseId })
        .returning();
      console.log(`Created resource '${r.type}' id=${resRow.id}`);
    }

    console.log("Seeding completed.");
  } catch (err) {
    console.error("Seeding failed:", err);
    throw err;
  }
  } catch (nativeErr) {
    console.warn(
      "better-sqlite3 unavailable. Falling back to sql.js (no native binding) to write seed data...",
      nativeErr,
    );
    await seedWithSqlJs();
  }
}

async function seedWithSqlJs() {
  // Resolve DB file
  const dbFile = process.env.DB_FILE || path.resolve(process.cwd(), ".data/db.sqlite");
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Load sql.js with WASM path
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const initSqlJs = (await import("sql.js/dist/sql-wasm.js")).default as unknown as (
    opts: { locateFile: (file: string) => string },
  ) => Promise<any>;
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  const bytes = fs.existsSync(dbFile) ? new Uint8Array(fs.readFileSync(dbFile)) : undefined;
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();

  try {
    db.exec("PRAGMA foreign_keys = ON;");

    console.log("[sql.js] Seeding users...");
    const email = "rescuer@drrms.org";
    const passwordHash = await bcrypt.hash("password123", 10);
    // Ensure users table exists (assumes migrations ran; this is a safety net)
    db.exec(
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);",
    );
    // Insert if not exists
    const selUser = db.prepare("SELECT id FROM users WHERE email = ?");
    const userRes = selUser.getAsObject([email]);
    selUser.free();
    if (!userRes.id) {
      const insUser = db.prepare(
        "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'rescuer', strftime('%s','now')*1000, strftime('%s','now')*1000)",
      );
      insUser.run(["Default Rescuer", email, passwordHash]);
      insUser.free();
      console.log("[sql.js] Created rescuer user");
    } else {
      console.log("[sql.js] Rescuer user already exists");
    }

    console.log("[sql.js] Seeding warehouses...");
    db.exec(
      "CREATE TABLE IF NOT EXISTS warehouses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);",
    );
    const warehouseName = "Mumbai Central Warehouse";
    let warehouseId: number | undefined;
    const selWh = db.prepare("SELECT id FROM warehouses WHERE name = ?");
    const whRes = selWh.getAsObject([warehouseName]);
    selWh.free();
    if (!whRes.id) {
      const insWh = db.prepare(
        "INSERT INTO warehouses (name, location, created_at, updated_at) VALUES (?, ?, strftime('%s','now')*1000, strftime('%s','now')*1000)",
      );
      insWh.run([warehouseName, "Mumbai, India"]);
      insWh.free();
      const lastIdStmt = db.prepare("SELECT id FROM warehouses WHERE name = ?");
      const lastRow = lastIdStmt.getAsObject([warehouseName]);
      lastIdStmt.free();
      warehouseId = lastRow.id as number;
      console.log(`[sql.js] Created warehouse id=${warehouseId}`);
    } else {
      warehouseId = whRes.id as number;
      console.log(`[sql.js] Warehouse already exists id=${warehouseId}`);
    }

    if (!warehouseId) throw new Error("Warehouse ID missing after insert/select");

    console.log("[sql.js] Seeding resources...");
    db.exec(
      "CREATE TABLE IF NOT EXISTS resources (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, quantity INTEGER NOT NULL, warehouse_id INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);",
    );
    const seedResources = [
      { type: "Water", quantity: 100 },
      { type: "Food", quantity: 500 },
      { type: "Medical Kits", quantity: 200 },
      { type: "Blankets", quantity: 400 },
      { type: "Fuel", quantity: 60 },
    ];
    for (const r of seedResources) {
      const selRes = db.prepare("SELECT id FROM resources WHERE warehouse_id = ? AND type = ?");
      const rRow = selRes.getAsObject([warehouseId, r.type]);
      selRes.free();
      if (rRow.id) {
        console.log(`[sql.js] Resource '${r.type}' already exists id=${rRow.id}`);
        continue;
      }
      const insRes = db.prepare(
        "INSERT INTO resources (type, quantity, warehouse_id, created_at, updated_at) VALUES (?, ?, ?, strftime('%s','now')*1000, strftime('%s','now')*1000)",
      );
      insRes.run([r.type, r.quantity, warehouseId]);
      insRes.free();
      console.log(`[sql.js] Created resource '${r.type}'`);
    }

    const data = db.export();
    fs.writeFileSync(dbFile, Buffer.from(data));
    db.close();
    console.log("[sql.js] Seeding completed.");
  } catch (e) {
    try {
      db.close();
    } catch {}
    console.error("[sql.js] Seeding failed:", e);
    throw e;
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
