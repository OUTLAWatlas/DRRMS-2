CREATE TABLE IF NOT EXISTS "allocation_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"allocation_id" integer,
	"request_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"warehouse_id" integer,
	"quantity" integer NOT NULL,
	"event_type" text NOT NULL,
	"note" text,
	"actor_id" integer,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "allocation_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"resource_id" integer,
	"warehouse_id" integer,
	"quantity" integer,
	"score" integer NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"rationale" text,
	"applied_allocation_id" integer,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demand_feature_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket_start" bigint NOT NULL,
	"bucket_end" bigint NOT NULL,
	"region" text NOT NULL,
	"resource_type" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"pending_count" integer DEFAULT 0 NOT NULL,
	"in_progress_count" integer DEFAULT 0 NOT NULL,
	"fulfilled_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"avg_people" double precision,
	"avg_severity_score" double precision,
	"median_wait_mins" double precision,
	"inventory_available" integer,
	"open_allocations" integer,
	"weather_alert_level" text,
	"precipitation_mm" double precision,
	"wind_speed_kph" double precision,
	"humidity" integer,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disaster_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"what_happened" text NOT NULL,
	"location" text NOT NULL,
	"severity" text DEFAULT 'Low' NOT NULL,
	"occurred_at" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "distribution_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"destination" text NOT NULL,
	"request_id" integer,
	"notes" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_by" integer,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "government_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"headline" text NOT NULL,
	"area" text,
	"severity" text,
	"certainty" text,
	"urgency" text,
	"source" text DEFAULT 'mock' NOT NULL,
	"issued_at" bigint,
	"expires_at" bigint,
	"summary" text,
	"raw_payload" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_weather_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"location_name" text NOT NULL,
	"temperature_c" double precision,
	"wind_speed_kph" double precision,
	"humidity" integer,
	"precipitation_mm" double precision,
	"condition" text,
	"alert_level" text DEFAULT 'normal' NOT NULL,
	"source" text DEFAULT 'mock' NOT NULL,
	"recorded_at" bigint NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictive_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor_id" integer,
	"notes" text,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictive_model_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_name" text NOT NULL,
	"version" text NOT NULL,
	"run_type" text DEFAULT 'inference' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metrics_json" text,
	"started_at" bigint,
	"completed_at" bigint,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictive_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer,
	"region" text,
	"resource_type" text NOT NULL,
	"suggested_quantity" integer NOT NULL,
	"confidence" double precision,
	"impact_score" double precision,
	"lead_time_minutes" integer,
	"status" text DEFAULT 'suggested' NOT NULL,
	"rationale" text,
	"model_run_id" integer,
	"feature_snapshot_id" integer,
	"valid_from" bigint NOT NULL,
	"valid_until" bigint,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_event_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer,
	"event_type" text NOT NULL,
	"payload" text,
	"actor_id" integer,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_feature_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"snapshot_at" bigint NOT NULL,
	"people_count" integer,
	"priority" text,
	"severity_score" double precision,
	"weather_layer" text,
	"travel_time_minutes" double precision,
	"supply_pressure" double precision,
	"model_features" text,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_priority_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"severity_weight" integer DEFAULT 0 NOT NULL,
	"people_weight" integer DEFAULT 0 NOT NULL,
	"age_weight" integer DEFAULT 0 NOT NULL,
	"supply_pressure_weight" integer DEFAULT 0 NOT NULL,
	"proximity_weight" integer DEFAULT 0 NOT NULL,
	"hub_capacity_weight" integer DEFAULT 0 NOT NULL,
	"nearest_warehouse_id" integer,
	"nearest_warehouse_distance_km" double precision,
	"hub_capacity_ratio" double precision,
	"recommended_resource_id" integer,
	"recommended_warehouse_id" integer,
	"recommended_quantity" integer,
	"rationale" text,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rescue_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"location" text NOT NULL,
	"details" text NOT NULL,
	"people_count" integer,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"criticality_score" integer DEFAULT 0 NOT NULL,
	"last_scored_at" bigint,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"allocated_by" integer NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"notes" text,
	"latitude" double precision,
	"longitude" double precision,
	"allocated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"from_warehouse_id" integer,
	"to_warehouse_id" integer,
	"quantity" integer NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'units' NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"warehouse_id" integer NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"direction" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"description" text,
	"request_id" integer,
	"recorded_by" integer,
	"recorded_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'survivor' NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"last_audited_at" bigint,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_history" ADD CONSTRAINT "allocation_history_allocation_id_resource_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."resource_allocations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_history" ADD CONSTRAINT "allocation_history_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_history" ADD CONSTRAINT "allocation_history_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_history" ADD CONSTRAINT "allocation_history_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_history" ADD CONSTRAINT "allocation_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_recommendations" ADD CONSTRAINT "allocation_recommendations_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_recommendations" ADD CONSTRAINT "allocation_recommendations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_recommendations" ADD CONSTRAINT "allocation_recommendations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_recommendations" ADD CONSTRAINT "allocation_recommendations_applied_allocation_id_resource_allocations_id_fk" FOREIGN KEY ("applied_allocation_id") REFERENCES "public"."resource_allocations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_logs" ADD CONSTRAINT "distribution_logs_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_logs" ADD CONSTRAINT "distribution_logs_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_logs" ADD CONSTRAINT "distribution_logs_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_logs" ADD CONSTRAINT "distribution_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictive_feedback" ADD CONSTRAINT "predictive_feedback_recommendation_id_predictive_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."predictive_recommendations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictive_feedback" ADD CONSTRAINT "predictive_feedback_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictive_recommendations" ADD CONSTRAINT "predictive_recommendations_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictive_recommendations" ADD CONSTRAINT "predictive_recommendations_model_run_id_predictive_model_runs_id_fk" FOREIGN KEY ("model_run_id") REFERENCES "public"."predictive_model_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictive_recommendations" ADD CONSTRAINT "predictive_recommendations_feature_snapshot_id_request_feature_snapshots_id_fk" FOREIGN KEY ("feature_snapshot_id") REFERENCES "public"."request_feature_snapshots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_event_log" ADD CONSTRAINT "request_event_log_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_event_log" ADD CONSTRAINT "request_event_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_feature_snapshots" ADD CONSTRAINT "request_feature_snapshots_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_priority_snapshots" ADD CONSTRAINT "request_priority_snapshots_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_priority_snapshots" ADD CONSTRAINT "request_priority_snapshots_nearest_warehouse_id_warehouses_id_fk" FOREIGN KEY ("nearest_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_priority_snapshots" ADD CONSTRAINT "request_priority_snapshots_recommended_resource_id_resources_id_fk" FOREIGN KEY ("recommended_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_priority_snapshots" ADD CONSTRAINT "request_priority_snapshots_recommended_warehouse_id_warehouses_id_fk" FOREIGN KEY ("recommended_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rescue_requests" ADD CONSTRAINT "rescue_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_allocated_by_users_id_fk" FOREIGN KEY ("allocated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_transfers" ADD CONSTRAINT "resource_transfers_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_transfers" ADD CONSTRAINT "resource_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_transfers" ADD CONSTRAINT "resource_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_transfers" ADD CONSTRAINT "resource_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_request_id_rescue_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."rescue_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "demand_feature_snapshots_bucket_idx" ON "demand_feature_snapshots" USING btree ("bucket_start","region","resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "government_alerts_external_id_idx" ON "government_alerts" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictive_feedback_recommendation_idx" ON "predictive_feedback" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictive_recommendations_status_idx" ON "predictive_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "request_event_log_request_idx" ON "request_event_log" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");