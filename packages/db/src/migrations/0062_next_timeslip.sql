ALTER TABLE "aws_account" ADD COLUMN "event_feed_stale_since" timestamp;--> statement-breakpoint
ALTER TABLE "aws_account" ADD COLUMN "event_feed_alerted_at" timestamp;