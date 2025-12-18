CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"properties" json DEFAULT '{}'::json NOT NULL,
	"last_activity_at" timestamp,
	"last_email_sent_at" timestamp,
	"last_email_opened_at" timestamp,
	"last_email_clicked_at" timestamp,
	"emails_sent" integer DEFAULT 0 NOT NULL,
	"emails_opened" integer DEFAULT 0 NOT NULL,
	"emails_clicked" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"unsubscribed_at" timestamp,
	"bounced_at" timestamp,
	"complained_at" timestamp,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "contact_topic" (
	"contact_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"status" text DEFAULT 'subscribed' NOT NULL,
	"subscribed_at" timestamp DEFAULT now(),
	"unsubscribed_at" timestamp,
	CONSTRAINT "contact_topic_contact_id_topic_id_pk" PRIMARY KEY("contact_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"public" boolean DEFAULT true NOT NULL,
	"double_opt_in" boolean DEFAULT false NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"product" text NOT NULL,
	"source" text,
	"referrer" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_topic" ADD CONSTRAINT "contact_topic_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_topic" ADD CONSTRAINT "contact_topic_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_org_idx" ON "contact" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_email_idx" ON "contact" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_unique_org_email_idx" ON "contact" USING btree ("organization_id","email_hash");--> statement-breakpoint
CREATE INDEX "contact_status_idx" ON "contact" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "contact_topic_topic_idx" ON "contact_topic" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "contact_topic_status_idx" ON "contact_topic" USING btree ("topic_id","status");--> statement-breakpoint
CREATE INDEX "topic_org_idx" ON "topic" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_unique_org_slug_idx" ON "topic" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_product_idx" ON "waitlist" USING btree ("email_hash","product");--> statement-breakpoint
CREATE INDEX "waitlist_product_idx" ON "waitlist" USING btree ("product");--> statement-breakpoint
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");