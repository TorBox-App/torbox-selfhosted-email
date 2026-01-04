CREATE TABLE "contact_event" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"event_name" text NOT NULL,
	"event_data" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_event" ADD CONSTRAINT "contact_event_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_event" ADD CONSTRAINT "contact_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_event_contact_idx" ON "contact_event" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_event_org_event_idx" ON "contact_event" USING btree ("organization_id","event_name");--> statement-breakpoint
CREATE INDEX "contact_event_contact_event_idx" ON "contact_event" USING btree ("contact_id","event_name");