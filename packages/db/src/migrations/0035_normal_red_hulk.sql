ALTER TABLE "template" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "source_format" text DEFAULT 'tiptap' NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "source_hash" text;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "pushed_from_cli" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "last_pushed_at" timestamp;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "cli_project_path" text;--> statement-breakpoint
CREATE UNIQUE INDEX "template_org_slug_idx" ON "template" USING btree ("organization_id","slug");