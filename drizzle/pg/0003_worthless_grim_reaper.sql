CREATE TABLE IF NOT EXISTS "provider_health_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"event_type" text DEFAULT 'status_change' NOT NULL,
	"previous_status" text DEFAULT null,
	"next_status" text DEFAULT null,
	"severity" text,
	"message" text NOT NULL,
	"metadata" text,
	"observed_at" bigint NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_health_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"status" text DEFAULT 'healthy' NOT NULL,
	"uptime_percent" double precision,
	"latency_ms" integer,
	"active_incidents" integer DEFAULT 0 NOT NULL,
	"sla_tier" text,
	"coverage_region" text,
	"coverage_radius_km" double precision,
	"latitude" double precision,
	"longitude" double precision,
	"last_ping_at" bigint,
	"freshness_state" text DEFAULT 'fresh' NOT NULL,
	"data_sources" text,
	"metadata" text,
	"observed_at" bigint NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL,
	"roster_lead" text,
	"roster_contact" text,
	"roster_shift_starts_at" bigint,
	"roster_shift_ends_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_oncall_rosters" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"shift_owner" text NOT NULL,
	"role" text,
	"contact_channel" text,
	"escalation_policy" text,
	"shift_starts_at" bigint,
	"shift_ends_at" bigint,
	"coverage_notes" text,
	"metadata" text,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_events_provider_idx" ON "provider_health_events" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_events_observed_idx" ON "provider_health_events" USING btree ("observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_health_snapshots_provider_idx" ON "provider_health_snapshots" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_snapshots_observed_idx" ON "provider_health_snapshots" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_oncall_rosters_provider_idx" ON "provider_oncall_rosters" USING btree ("provider_id");