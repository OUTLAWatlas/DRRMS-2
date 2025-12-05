import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { users } from "../server/db/schema";

const email = "admin@drrms.org";
const password = "12345678";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required to run this script.");
  process.exit(1);
}

const sslEnabled = process.env.NODE_ENV === "production" || process.env.POSTGRES_SSL === "true";
const client = postgres(url, { ssl: sslEnabled ? { rejectUnauthorized: false } : undefined });
const db = drizzle(client);

async function createAdmin() {
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.log(`Admin user already exists with id ${existing[0].id}`);
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  const [inserted] = await db
    .insert(users)
    .values({
      name: "DRRMS Admin",
      email,
      passwordHash,
      role: "admin",
      isApproved: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  console.log(`Created admin user with id ${inserted.id}`);
}

createAdmin()
  .catch((err) => {
    console.error("Failed to create admin user", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
