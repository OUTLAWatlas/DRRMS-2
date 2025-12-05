import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set to run migrations");
  }

  const sslEnabled = process.env.NODE_ENV === "production" || process.env.POSTGRES_SSL === "true";
  const client = postgres(url, { ssl: sslEnabled ? { rejectUnauthorized: false } : undefined });
  const db = drizzle(client, { logger: process.env.DRIZZLE_LOG === "true" });

  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle/pg") });
  console.log("✅ Migrations applied successfully");
  await client.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed", err);
  process.exit(1);
});
