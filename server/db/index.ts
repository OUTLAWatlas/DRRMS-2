import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

let client: ReturnType<typeof postgres> | null = null;
let cachedDb: PostgresJsDatabase | null = null;

function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not defined. Please set it in your environment.");
  }
  return url;
}

function createClient() {
  const url = resolveDatabaseUrl();
  const sslEnabled = process.env.NODE_ENV === "production" || process.env.POSTGRES_SSL === "true";
  const poolSize = Number.parseInt(process.env.POSTGRES_POOL_SIZE ?? "10", 10);
  return postgres(url, {
    max: Number.isNaN(poolSize) ? 10 : poolSize,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });
}

export function getDb(): PostgresJsDatabase {
  if (cachedDb) return cachedDb;
  client = createClient();
  cachedDb = drizzle(client, {
    logger: process.env.DRIZZLE_LOG === "true",
  });
  return cachedDb;
}

export type DB = ReturnType<typeof getDb>;

export async function getDbAsync(): Promise<PostgresJsDatabase> {
  return getDb();
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    cachedDb = null;
  }
}
