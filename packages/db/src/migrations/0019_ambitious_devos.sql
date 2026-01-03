ALTER TABLE "batch_send" ADD COLUMN "audience_type" text DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "batch_send" ADD COLUMN "topic_id" text;--> statement-breakpoint
ALTER TABLE "batch_send" ADD COLUMN "segment_id" text;