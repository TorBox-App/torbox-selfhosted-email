ALTER TABLE "audit_log" ADD COLUMN "actor_email" text;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "metadata" SET DATA TYPE jsonb USING metadata::text::jsonb;--> statement-breakpoint
DROP INDEX IF EXISTS "audit_log_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_log_timestamp_idx";--> statement-breakpoint
CREATE INDEX "audit_log_org_created_idx" ON "audit_log" ("organization_id","created_at");
