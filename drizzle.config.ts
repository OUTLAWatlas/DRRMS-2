import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_FILE || "./.data/db.sqlite",
  },
  // Optional: verbose logs during generation/push
  verbose: true,
  strict: true,
});
