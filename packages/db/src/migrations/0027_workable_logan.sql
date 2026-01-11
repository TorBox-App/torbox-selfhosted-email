ALTER TYPE "public"."message_send_status" ADD VALUE 'suppressed' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "batch_send" ADD COLUMN "suppressed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "message_send" ADD COLUMN "suppressed_at" timestamp;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "email_suppressed_at" timestamp;