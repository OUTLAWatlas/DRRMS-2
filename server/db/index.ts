import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

let cachedDb: BetterSQLite3Database | null = null;

export function getDb(): BetterSQLite3Database {
  if (cachedDb) return cachedDb;
  // Lazy-load to avoid requiring native bindings during Vite startup/tests
  let BetterSqlite3: typeof Database;
  let drizzle: (db: Database) => BetterSQLite3Database;
  try {
    const require = createRequire(import.meta.url);
    ({ default: BetterSqlite3 } = require("better-sqlite3") as { default: typeof Database });
    ({ drizzle } = require("drizzle-orm/better-sqlite3") as {
      drizzle: (db: Database) => BetterSQLite3Database;
    });
  } catch (err) {
    console.error(
      "Database native module not available. Please run 'pnpm approve-builds' and select better-sqlite3, then rerun. Error:",
      err,
    );
    throw err;
  }

  const dbFile = process.env.DB_FILE || path.resolve(process.cwd(), ".data/db.sqlite");
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new BetterSqlite3(dbFile);
  cachedDb = drizzle(sqlite);
  return cachedDb;
}

export type DB = ReturnType<typeof getDb>;

export async function getDbAsync(): Promise<BetterSQLite3Database> {
  if (cachedDb) return cachedDb;
  try {
    const BetterSqlite3Mod = await import("better-sqlite3");
    const DrizzleMod = await import("drizzle-orm/better-sqlite3");
    const BetterSqlite3 = (BetterSqlite3Mod as unknown as { default: typeof Database }).default;
    const drizzle = (DrizzleMod as unknown as { drizzle: (db: Database) => BetterSQLite3Database }).drizzle;

    const dbFile = process.env.DB_FILE || path.resolve(process.cwd(), ".data/db.sqlite");
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sqlite = new BetterSqlite3(dbFile);
    cachedDb = drizzle(sqlite);
    return cachedDb;
  } catch (err) {
    console.error(
      "Failed to dynamically import better-sqlite3/drizzle-orm. Ensure native bindings are built (pnpm approve-builds). Error:",
      err,
    );
    throw err;
  }
}
