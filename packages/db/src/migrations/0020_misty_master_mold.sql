CREATE TYPE "public"."workflow_execution_status" AS ENUM('pending', 'active', 'paused', 'waiting', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'enabled', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_execution_status" AS ENUM('pending', 'executing', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"aws_account_id" text,
	"name" text NOT NULL,
	"description" text,
	"topic_id" text,
	"canvas_viewport" jsonb DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb,
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"trigger_type" text,
	"trigger_config" jsonb DEFAULT '{}'::jsonb,
	"steps" jsonb DEFAULT '[]'::jsonb,
	"transitions" jsonb DEFAULT '[]'::jsonb,
	"allow_reentry" boolean DEFAULT false NOT NULL,
	"reentry_delay_seconds" integer,
	"max_concurrent_executions" integer DEFAULT 1000,
	"contact_cooldown_seconds" integer,
	"total_executions" integer DEFAULT 0 NOT NULL,
	"active_executions" integer DEFAULT 0 NOT NULL,
	"completed_executions" integer DEFAULT 0 NOT NULL,
	"failed_executions" integer DEFAULT 0 NOT NULL,
	"dropped_executions" integer DEFAULT 0 NOT NULL,
	"ai_generated" boolean DEFAULT false,
	"ai_prompt" text,
	"last_triggered_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" "workflow_execution_status" DEFAULT 'pending' NOT NULL,
	"current_step_id" text,
	"context" jsonb DEFAULT '{}'::jsonb,
	"trigger_event_id" text,
	"trigger_data" jsonb,
	"waiting_for_event" text,
	"waiting_for_conditions" jsonb,
	"wait_timeout_at" timestamp,
	"wait_timeout_scheduler_name" text,
	"next_step_scheduled_at" timestamp,
	"delay_scheduler_name" text,
	"error" text,
	"error_step_id" text,
	"retry_count" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_id" text NOT NULL,
	"step_id" text NOT NULL,
	"step_type" text NOT NULL,
	"status" "workflow_step_execution_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"branch" text,
	"result" jsonb,
	"error" text,
	"skip_reason" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_aws_account_id_aws_account_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD CONSTRAINT "workflow_execution_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD CONSTRAINT "workflow_execution_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD CONSTRAINT "workflow_execution_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_execution" ADD CONSTRAINT "workflow_step_execution_execution_id_workflow_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_org_idx" ON "workflow" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workflow_status_idx" ON "workflow" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "workflow_trigger_type_idx" ON "workflow" USING btree ("organization_id","trigger_type");--> statement-breakpoint
CREATE INDEX "workflow_aws_account_idx" ON "workflow" USING btree ("aws_account_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_workflow_idx" ON "workflow_execution" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_contact_idx" ON "workflow_execution" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_org_idx" ON "workflow_execution" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_status_idx" ON "workflow_execution" USING btree ("workflow_id","status");--> statement-breakpoint
CREATE INDEX "workflow_execution_org_status_idx" ON "workflow_execution" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "workflow_execution_scheduled_idx" ON "workflow_execution" USING btree ("next_step_scheduled_at");--> statement-breakpoint
CREATE INDEX "workflow_execution_waiting_event_idx" ON "workflow_execution" USING btree ("organization_id","waiting_for_event");--> statement-breakpoint
CREATE INDEX "workflow_step_execution_execution_idx" ON "workflow_step_execution" USING btree ("execution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_step_execution_idempotency_idx" ON "workflow_step_execution" USING btree ("idempotency_key");