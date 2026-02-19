ALTER TABLE "workflow" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD COLUMN "definition_snapshot" jsonb;