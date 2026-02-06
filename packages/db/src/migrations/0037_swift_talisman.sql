ALTER TABLE "workflow" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "source_ts" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "source_hash" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "pushed_from_cli" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "last_pushed_at" timestamp;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "cli_project_path" text;--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "last_edited_from" text;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_org_slug_idx" ON "workflow" USING btree ("organization_id","slug");