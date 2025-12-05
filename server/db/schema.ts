import { sql } from "drizzle-orm";
import { bigint, boolean, doublePrecision, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

const nowMs = sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint`;

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    mfaSecret: text("mfa_secret"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaRecoveryCodes: text("mfa_recovery_codes"),
    lastMfaVerifiedAt: bigint("last_mfa_verified_at", { mode: "number" }),
    role: text("role")
      .$type<"survivor" | "rescuer" | "admin">()
      .notNull()
      .default("survivor"),
    isApproved: boolean("is_approved").notNull().default(true),
    isBlocked: boolean("is_blocked").notNull().default(false),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowMs),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const disasterReports = pgTable("disaster_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  whatHappened: text("what_happened").notNull(),
  location: text("location").notNull(),
  severity: text("severity")
    .$type<"Low" | "Moderate" | "High" | "Critical">()
    .notNull()
    .default("Low"),
  occurredAt: bigint("occurred_at", { mode: "number" }),
  status: text("status")
    .$type<"pending" | "in_progress" | "resolved" | "rejected">()
    .notNull()
    .default("pending"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowMs),
});

export const rescueRequests = pgTable("rescue_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  location: text("location").notNull(),
  details: text("details").notNull(),
  detailsDigest: text("details_digest"),
  peopleCount: integer("people_count"),
  priority: text("priority")
    .$type<"low" | "medium" | "high">()
    .notNull()
    .default("medium"),
  status: text("status")
    .$type<"pending" | "in_progress" | "fulfilled" | "cancelled">()
    .notNull()
    .default("pending"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  criticalityScore: integer("criticality_score").notNull().default(0),
  lastScoredAt: bigint("last_scored_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowMs),
});

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  capacity: integer("capacity").notNull().default(0),
  lastAuditedAt: bigint("last_audited_at", { mode: "number" }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowMs),
});

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull().default(0),
  unit: text("unit").notNull().default("units"),
  reorderLevel: integer("reorder_level").notNull().default(0),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowMs),
});

export const resourceTransfers = pgTable("resource_transfers", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  fromWarehouseId: integer("from_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  toWarehouseId: integer("to_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const distributionLogs = pgTable("distribution_logs", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  destination: text("destination").notNull(),
  requestId: integer("request_id").references(() => rescueRequests.id, { onDelete: "set null" }),
  notes: text("notes"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const resourceAllocations = pgTable("resource_allocations", {
  id: serial("id").primaryKey(),
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
  status: text("status")
    .$type<"booked" | "dispatched" | "released">()
    .notNull()
    .default("booked"),
  notes: text("notes"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  allocatedAt: bigint("allocated_at", { mode: "number" }).notNull().default(nowMs),
});

export const requestPrioritySnapshots = pgTable("request_priority_snapshots", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => rescueRequests.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(0),
  severityWeight: integer("severity_weight").notNull().default(0),
  peopleWeight: integer("people_weight").notNull().default(0),
  ageWeight: integer("age_weight").notNull().default(0),
  supplyPressureWeight: integer("supply_pressure_weight").notNull().default(0),
  proximityWeight: integer("proximity_weight").notNull().default(0),
  hubCapacityWeight: integer("hub_capacity_weight").notNull().default(0),
  nearestWarehouseId: integer("nearest_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  nearestWarehouseDistanceKm: doublePrecision("nearest_warehouse_distance_km"),
  hubCapacityRatio: doublePrecision("hub_capacity_ratio"),
  recommendedResourceId: integer("recommended_resource_id").references(() => resources.id, { onDelete: "set null" }),
  recommendedWarehouseId: integer("recommended_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  recommendedQuantity: integer("recommended_quantity"),
  rationale: text("rationale"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const allocationRecommendations = pgTable("allocation_recommendations", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => rescueRequests.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id").references(() => resources.id, { onDelete: "set null" }),
  warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  quantity: integer("quantity"),
  score: integer("score").notNull(),
  status: text("status")
    .$type<"suggested" | "applied" | "dismissed">()
    .notNull()
    .default("suggested"),
  rationale: text("rationale"),
  appliedAllocationId: integer("applied_allocation_id").references(() => resourceAllocations.id, { onDelete: "set null" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const allocationHistory = pgTable("allocation_history", {
  id: serial("id").primaryKey(),
  allocationId: integer("allocation_id").references(() => resourceAllocations.id, { onDelete: "cascade" }),
  requestId: integer("request_id")
    .notNull()
    .references(() => rescueRequests.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  eventType: text("event_type")
    .$type<"booked" | "dispatched" | "released">()
    .notNull(),
  note: text("note"),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull(),
  direction: text("direction")
    .$type<"income" | "expense">()
    .notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("INR"),
  category: text("category").notNull().default("general"),
  description: text("description"),
  requestId: integer("request_id").references(() => rescueRequests.id, { onDelete: "set null" }),
  recordedBy: integer("recorded_by").references(() => users.id, { onDelete: "set null" }),
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull().default(nowMs),
});

export const liveWeatherReadings = pgTable("live_weather_readings", {
  id: serial("id").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  locationName: text("location_name").notNull(),
  temperatureC: doublePrecision("temperature_c"),
  windSpeedKph: doublePrecision("wind_speed_kph"),
  humidity: integer("humidity"),
  precipitationMm: doublePrecision("precipitation_mm"),
  condition: text("condition"),
  alertLevel: text("alert_level").notNull().default("normal"),
  source: text("source").notNull().default("mock"),
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const governmentAlerts = pgTable(
  "government_alerts",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").notNull(),
    headline: text("headline").notNull(),
    area: text("area"),
    severity: text("severity"),
    certainty: text("certainty"),
    urgency: text("urgency"),
    source: text("source").notNull().default("mock"),
    issuedAt: bigint("issued_at", { mode: "number" }),
    expiresAt: bigint("expires_at", { mode: "number" }),
    summary: text("summary"),
    rawPayload: text("raw_payload"),
    status: text("status").notNull().default("active"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  },
  (table) => ({
    externalIdx: uniqueIndex("government_alerts_external_id_idx").on(table.externalId),
  }),
);

export type Role = typeof users.$inferSelect["role"];

export const requestEventLog = pgTable(
  "request_event_log",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").references(() => rescueRequests.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: text("payload"),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  },
  (table) => ({
    requestIdx: index("request_event_log_request_idx").on(table.requestId),
  }),
);

export const demandFeatureSnapshots = pgTable(
  "demand_feature_snapshots",
  {
    id: serial("id").primaryKey(),
    bucketStart: bigint("bucket_start", { mode: "number" }).notNull(),
    bucketEnd: bigint("bucket_end", { mode: "number" }).notNull(),
    region: text("region").notNull(),
    resourceType: text("resource_type").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    pendingCount: integer("pending_count").notNull().default(0),
    inProgressCount: integer("in_progress_count").notNull().default(0),
    fulfilledCount: integer("fulfilled_count").notNull().default(0),
    cancelledCount: integer("cancelled_count").notNull().default(0),
    avgPeople: doublePrecision("avg_people"),
    avgSeverityScore: doublePrecision("avg_severity_score"),
    medianWaitMins: doublePrecision("median_wait_mins"),
    inventoryAvailable: integer("inventory_available"),
    openAllocations: integer("open_allocations"),
    weatherAlertLevel: text("weather_alert_level"),
    precipitationMm: doublePrecision("precipitation_mm"),
    windSpeedKph: doublePrecision("wind_speed_kph"),
    humidity: integer("humidity"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  },
  (table) => ({
    bucketIdx: uniqueIndex("demand_feature_snapshots_bucket_idx").on(
      table.bucketStart,
      table.region,
      table.resourceType,
    ),
  }),
);

export const transparencyReports = pgTable(
  "transparency_reports",
  {
    id: serial("id").primaryKey(),
    bucketStart: bigint("bucket_start", { mode: "number" }).notNull(),
    bucketEnd: bigint("bucket_end", { mode: "number" }).notNull(),
    generatedAt: bigint("generated_at", { mode: "number" }).notNull().default(nowMs),
    payload: text("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    signature: text("signature"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("sealed"),
    metadata: text("metadata"),
  },
  (table) => ({
    bucketIdx: uniqueIndex("transparency_reports_bucket_idx").on(table.bucketStart),
  }),
);

export const requestFeatureSnapshots = pgTable("request_feature_snapshots", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => rescueRequests.id, { onDelete: "cascade" }),
  snapshotAt: bigint("snapshot_at", { mode: "number" }).notNull(),
  peopleCount: integer("people_count"),
  priority: text("priority"),
  severityScore: doublePrecision("severity_score"),
  weatherLayer: text("weather_layer"),
  travelTimeMinutes: doublePrecision("travel_time_minutes"),
  supplyPressure: doublePrecision("supply_pressure"),
  modelFeatures: text("model_features"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const predictiveModelRuns = pgTable("predictive_model_runs", {
  id: serial("id").primaryKey(),
  modelName: text("model_name").notNull(),
  version: text("version").notNull(),
  runType: text("run_type").notNull().default("inference"),
  status: text("status").notNull().default("pending"),
  metricsJson: text("metrics_json"),
  startedAt: bigint("started_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
});

export const predictiveRecommendations = pgTable(
  "predictive_recommendations",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").references(() => rescueRequests.id, { onDelete: "set null" }),
    region: text("region"),
    resourceType: text("resource_type").notNull(),
    suggestedQuantity: integer("suggested_quantity").notNull(),
    confidence: doublePrecision("confidence"),
    impactScore: doublePrecision("impact_score"),
    leadTimeMinutes: integer("lead_time_minutes"),
    status: text("status").notNull().default("suggested"),
    rationale: text("rationale"),
    modelRunId: integer("model_run_id").references(() => predictiveModelRuns.id, { onDelete: "set null" }),
    featureSnapshotId: integer("feature_snapshot_id").references(() => requestFeatureSnapshots.id, {
      onDelete: "set null",
    }),
    validFrom: bigint("valid_from", { mode: "number" }).notNull(),
    validUntil: bigint("valid_until", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowMs),
  },
  (table) => ({
    statusIdx: index("predictive_recommendations_status_idx").on(table.status),
  }),
);

export const predictiveFeedback = pgTable(
  "predictive_feedback",
  {
    id: serial("id").primaryKey(),
    recommendationId: integer("recommendation_id")
      .notNull()
      .references(() => predictiveRecommendations.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowMs),
  },
  (table) => ({
    recommendationIdx: index("predictive_feedback_recommendation_idx").on(table.recommendationId),
  }),
);

export const schedulerMetrics = pgTable("scheduler_metrics", {
  name: text("name").primaryKey(),
  lastRunAt: bigint("last_run_at", { mode: "number" }),
  lastSuccessAt: bigint("last_success_at", { mode: "number" }),
  lastErrorAt: bigint("last_error_at", { mode: "number" }),
  lastDurationMs: integer("last_duration_ms"),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastErrorMessage: text("last_error_message"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowMs),
});
