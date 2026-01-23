ALTER TABLE "aws_account" ADD COLUMN "email_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aws_account" ADD COLUMN "features" json;--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "archiving_enabled";--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "archive_arn";--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "event_history_enabled";--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "event_tracking_enabled";--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "config_set_name";--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "custom_tracking_domain";--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "sms_phone_number_count";--> statement-breakpoint
ALTER TABLE "aws_account" DROP COLUMN "sms_event_history_enabled";