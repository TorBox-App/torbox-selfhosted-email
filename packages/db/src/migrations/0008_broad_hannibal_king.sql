CREATE TABLE "ai_usage_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"period_key" text NOT NULL,
	"feature_type" text DEFAULT 'ai_chat' NOT NULL,
	"template_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"model" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_monthly" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_key" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_monthly" ADD CONSTRAINT "ai_usage_monthly_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_log_org_idx" ON "ai_usage_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_usage_log_period_idx" ON "ai_usage_log" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "ai_usage_log_org_period_idx" ON "ai_usage_log" USING btree ("organization_id","period_key");--> statement-breakpoint
CREATE INDEX "ai_usage_log_user_idx" ON "ai_usage_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_log_created_idx" ON "ai_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_monthly_org_period_idx" ON "ai_usage_monthly" USING btree ("organization_id","period_key");--> statement-breakpoint
CREATE INDEX "ai_usage_monthly_period_idx" ON "ai_usage_monthly" USING btree ("period_key");