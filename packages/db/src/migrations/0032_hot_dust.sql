CREATE TABLE "message_usage_monthly" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_key" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_usage_monthly" ADD CONSTRAINT "message_usage_monthly_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_usage_monthly_org_period_idx" ON "message_usage_monthly" USING btree ("organization_id","period_key");--> statement-breakpoint
CREATE INDEX "message_usage_monthly_period_idx" ON "message_usage_monthly" USING btree ("period_key");