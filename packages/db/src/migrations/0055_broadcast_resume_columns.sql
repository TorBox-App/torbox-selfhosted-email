DROP INDEX "aws_account_permission_unique_idx";--> statement-breakpoint
ALTER TABLE "template_version" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_send" ADD COLUMN "last_chunk_at" timestamp;--> statement-breakpoint
ALTER TABLE "batch_send" ADD COLUMN "last_chunk_index" integer;--> statement-breakpoint
ALTER TABLE "batch_send" ADD COLUMN "last_cursor" json;--> statement-breakpoint
-- NOTE: "message_send_dedup_idx" and "contact_keyset_idx" are declared in the
-- Drizzle schema but are created out-of-band via
-- packages/db/scripts/create-broadcast-resume-indexes.ts (CREATE INDEX
-- CONCURRENTLY). drizzle-kit cannot run CONCURRENTLY inside a txn block.
-- Run that script AFTER this migration applies but BEFORE shipping the DLQ
-- consumer or worker resume columns are used in production.
CREATE UNIQUE INDEX "aws_account_permission_unique_idx" ON "aws_account_permission" USING btree ("user_id","aws_account_id");
