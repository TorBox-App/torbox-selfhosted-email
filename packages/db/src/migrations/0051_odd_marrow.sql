ALTER TABLE "organization_extension" ADD COLUMN "onboarding_path" text;--> statement-breakpoint
ALTER TABLE "organization_extension" ADD COLUMN "activation_score" integer DEFAULT 0 NOT NULL;