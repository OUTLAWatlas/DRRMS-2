CREATE TABLE IF NOT EXISTS "scheduler_metrics" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" bigint,
	"last_success_at" bigint,
	"last_error_at" bigint,
	"last_duration_ms" integer,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error_message" text,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transparency_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_type" text NOT NULL,
	"payload" text NOT NULL,
	"payload_hash" text NOT NULL,
	"previous_hash" text,
	"entry_hash" text NOT NULL,
	"signature" text,
	"actor_id" integer,
	"metadata" text,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transparency_ledger" ADD CONSTRAINT "transparency_ledger_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transparency_ledger_entry_hash_idx" ON "transparency_ledger" USING btree ("entry_hash");