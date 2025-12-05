ALTER TABLE "users" ADD COLUMN "mfa_secret" text;
ALTER TABLE "users" ADD COLUMN "mfa_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfa_recovery_codes" text;
ALTER TABLE "users" ADD COLUMN "last_mfa_verified_at" bigint;
ALTER TABLE "rescue_requests" ADD COLUMN "details_digest" text;

CREATE TABLE IF NOT EXISTS "transparency_reports" (
    "id" serial PRIMARY KEY,
    "bucket_start" bigint NOT NULL,
    "bucket_end" bigint NOT NULL,
    "generated_at" bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
    "payload" text NOT NULL,
    "payload_hash" text NOT NULL,
    "signature" text,
    "created_by" integer,
    "status" text NOT NULL DEFAULT 'sealed',
    "metadata" text,
    CONSTRAINT "transparency_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "transparency_reports_bucket_idx" ON "transparency_reports" ("bucket_start");