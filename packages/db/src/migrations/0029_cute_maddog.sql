CREATE TABLE "event_usage_monthly" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_key" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_event" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_usage_monthly" ADD CONSTRAINT "event_usage_monthly_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_usage_monthly_org_period_idx" ON "event_usage_monthly" USING btree ("organization_id","period_key");--> statement-breakpoint
CREATE INDEX "event_usage_monthly_period_idx" ON "event_usage_monthly" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "contact_event_expires_idx" ON "contact_event" USING btree ("expires_at");