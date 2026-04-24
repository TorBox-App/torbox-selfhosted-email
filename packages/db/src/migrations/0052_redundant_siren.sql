DROP INDEX "aws_account_permission_unique_idx";--> statement-breakpoint
ALTER TABLE "template_version" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_unique_org_external_id_idx" ON "contact" USING btree ("organization_id","external_id") WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "aws_account_permission_unique_idx" ON "aws_account_permission" USING btree ("user_id","aws_account_id");