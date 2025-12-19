ALTER TABLE "aws_account" ADD COLUMN "sms_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aws_account" ADD COLUMN "sms_phone_number_count" integer DEFAULT 0 NOT NULL;