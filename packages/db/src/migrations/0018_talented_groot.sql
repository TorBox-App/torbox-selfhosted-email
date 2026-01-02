CREATE TYPE "public"."email_type" AS ENUM('marketing', 'transactional');--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "topic_settings" ADD COLUMN "confirmation_template_id" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "email_type" "email_type" DEFAULT 'marketing' NOT NULL;--> statement-breakpoint
ALTER TABLE "topic_settings" ADD CONSTRAINT "topic_settings_confirmation_template_id_template_id_fk" FOREIGN KEY ("confirmation_template_id") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;