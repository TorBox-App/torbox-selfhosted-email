CREATE TYPE "public"."agent_approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('ACTIVE', 'KILLED');--> statement-breakpoint
CREATE TABLE "agent" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"email_address" text NOT NULL,
	"domain" text NOT NULL,
	"status" "agent_status" DEFAULT 'ACTIVE' NOT NULL,
	"policy" jsonb NOT NULL,
	"credential_user_arn" text,
	"enforcer_function_arn" text,
	"aws_account_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_approval_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"reason" text,
	"status" "agent_approval_status" DEFAULT 'PENDING' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp,
	"message_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approval_queue" ADD CONSTRAINT "agent_approval_queue_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approval_queue" ADD CONSTRAINT "agent_approval_queue_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approval_queue" ADD CONSTRAINT "agent_approval_queue_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_org_idx" ON "agent" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_unique_org_name_idx" ON "agent" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "agent_approval_queue_org_idx" ON "agent_approval_queue" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_approval_queue_org_status_idx" ON "agent_approval_queue" USING btree ("organization_id","status");