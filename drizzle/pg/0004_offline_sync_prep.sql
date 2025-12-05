ALTER TABLE "rescue_requests" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "resource_allocations" ADD COLUMN IF NOT EXISTS "updated_at" bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
ALTER TABLE "resource_allocations" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
