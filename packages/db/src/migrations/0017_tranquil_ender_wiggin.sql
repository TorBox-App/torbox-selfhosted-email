CREATE TABLE "topic_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"confirmation_from_name" text,
	"confirmation_from_email" text,
	"confirmation_reply_to_email" text,
	"preference_center_title" text,
	"preference_center_description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topic_settings" ADD CONSTRAINT "topic_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;