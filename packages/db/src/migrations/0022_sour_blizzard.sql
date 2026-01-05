ALTER TABLE "organization_extension" ADD COLUMN "default_aws_account_id" text;--> statement-breakpoint
ALTER TABLE "organization_extension" ADD COLUMN "default_from" text;--> statement-breakpoint
ALTER TABLE "organization_extension" ADD COLUMN "default_from_name" text;--> statement-breakpoint
ALTER TABLE "organization_extension" ADD COLUMN "default_reply_to" text;--> statement-breakpoint
ALTER TABLE "organization_extension" ADD COLUMN "default_sender_id" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "default_from" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "default_from_name" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "default_reply_to" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "default_sender_id" text;--> statement-breakpoint
ALTER TABLE "organization_extension" ADD CONSTRAINT "organization_extension_default_aws_account_id_aws_account_id_fk" FOREIGN KEY ("default_aws_account_id") REFERENCES "public"."aws_account"("id") ON DELETE set null ON UPDATE no action;