import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  real,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["survivor", "rescuer", "admin"] as const })
    .notNull()
    .default("survivor"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`) // default initial value
    .$onUpdateFn(() => sql`(unixepoch() * 1000)`),
});

export const disasterReports = sqliteTable("disaster_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  whatHappened: text("what_happened").notNull(),
  location: text("location").notNull(),
  severity: text("severity", {
    enum: ["Low", "Moderate", "High", "Critical"] as const,
  })
    .notNull()
    .default("Low"),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }),
  status: text("status", {
    enum: ["pending", "in_progress", "resolved", "rejected"] as const,
  })
    .notNull()
    .default("pending"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`) // initial value
    .$onUpdateFn(() => sql`(unixepoch() * 1000)`),
});

export const rescueRequests = sqliteTable("rescue_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  location: text("location").notNull(),
  details: text("details").notNull(),
  peopleCount: integer("people_count"),
  priority: text("priority", { enum: ["low", "medium", "high"] as const })
    .notNull()
    .default("medium"),
  status: text("status", {
    enum: ["pending", "in_progress", "fulfilled", "cancelled"] as const,
  })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`) // initial value
    .$onUpdateFn(() => sql`(unixepoch() * 1000)`),
});

export const warehouses = sqliteTable("warehouses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  location: text("location").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`) // initial value
    .$onUpdateFn(() => sql`(unixepoch() * 1000)`),
});

export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull().default(0),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`) // initial value
    .$onUpdateFn(() => sql`(unixepoch() * 1000)`),
});

export const resourceAllocations = sqliteTable("resource_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id")
    .notNull()
    .references(() => rescueRequests.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  allocatedBy: integer("allocated_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  allocatedAt: integer("allocated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type Role = typeof users.$inferSelect["role"];
