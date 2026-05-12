"use server";

import { render, toPlainText } from "@react-email/render";
import type { JSONContent } from "@tiptap/core";
import { auth } from "@wraps/auth";
import type { EmailType } from "@wraps/db";
import { auditLog, awsAccount, brandKit, db, template } from "@wraps/db";
import {
  deleteSESTemplate,
  generateSESTemplateName,
  transformVariablesForSes,
  upsertSESTemplate,
} from "@wraps/email";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { trackTemplatePublished } from "@/lib/activation-tracking";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import { createActionLogger } from "@/lib/logger";
import {
  tiptapToReactEmail,
  toBrandKitColors,
} from "@/lib/serializers/tiptap-to-react-email";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";

export type PublishTemplateResult =
  | { success: true; sesTemplateName: string }
  | { success: false; error: string };

// Bulk action result types
export type BulkDeleteResult =
  | { success: true; count: number }
  | { success: false; error: string };

export type BulkUpdateTypeResult =
  | { success: true; count: number }
  | { success: false; error: string };

export type BulkUpdateStatusResult =
  | {
      success: true;
      updated: number;
      published: number;
      skipped: string[];
      errors: string[];
    }
  | { success: false; error: string };

/**
 * Revalidate templates page using the org slug
 */
function revalidateTemplates(orgSlug: string): void {
  revalidatePath(`/${orgSlug}/emails/templates`, "page");
}

/**
 * Publish a template to SES.
 *
 * This function handles:
 * 1. Converting TipTap content to HTML with variables as placeholders
 * 2. Transforming variables to SES-compatible format
 * 3. Uploading to SES
 * 4. Updating the template record with sesTemplateName
 *
 * Can be called from:
 * - The publish API route (for manual publish from UI)
 * - The createBatchSend action (for auto-publish before sending)
 */
export async function publishTemplateToSES(
  templateId: string,
  organizationId: string,
  options: {
    brandKitId?: string;
  } = {}
): Promise<PublishTemplateResult> {
  // Verify caller has access to this organization
  const access = await verifyOrgAccess(organizationId);
  if (!access) {
    return {
      success: false,
      error: "You don't have access to this organization",
    };
  }
  const permError = checkPermission(access.role, "templates", ["write"]);
  if (permError) return permError;

  const log = createActionLogger("publishTemplateToSES", {
    orgSlug: access.orgSlug,
  });

  const auditCtx = await getAuditContext();

  try {
    // Fetch template
    const templateData = await db.query.template.findFirst({
      where: and(
        eq(template.id, templateId),
        eq(template.organizationId, organizationId)
      ),
    });

    if (!templateData) {
      return { success: false, error: "Template not found" };
    }

    // SMS templates don't need SES publishing
    if (templateData.channel === "sms") {
      const now = new Date();
      await db
        .update(template)
        .set({
          status: "PUBLISHED",
          publishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(template.id, templateId),
            eq(template.organizationId, organizationId)
          )
        );
      return { success: true, sesTemplateName: "" };
    }

    // Validate subject is set
    if (!templateData.subject) {
      return {
        success: false,
        error:
          "Template subject is required for publishing. Please set a subject line.",
      };
    }

    // Get the organization's AWS account
    const customerAwsAccount = await db.query.awsAccount.findFirst({
      where: eq(awsAccount.organizationId, organizationId),
    });

    if (!customerAwsAccount) {
      return {
        success: false,
        error: "No AWS account connected. Please connect an AWS account first.",
      };
    }

    // Get credentials for the customer's AWS account
    const credentials = await getOrAssumeRole({
      roleArn: customerAwsAccount.roleArn,
      externalId: customerAwsAccount.externalId,
      region: customerAwsAccount.region,
    });

    // Fetch brand kit (use specified one or default for org)
    let selectedBrandKit = null;
    if (options.brandKitId) {
      selectedBrandKit = await db.query.brandKit.findFirst({
        where: and(
          eq(brandKit.id, options.brandKitId),
          eq(brandKit.organizationId, organizationId)
        ),
      });
    } else {
      selectedBrandKit = await db.query.brandKit.findFirst({
        where: and(
          eq(brandKit.organizationId, organizationId),
          eq(brandKit.isDefault, true)
        ),
      });
    }

    // Build HTML and text from the appropriate source format
    let rawHtml: string;
    let rawText: string;

    if (
      templateData.sourceFormat === "react-email" &&
      templateData.compiledHtml
    ) {
      // React-email templates already have compiled HTML from save-source or CLI push
      rawHtml = templateData.compiledHtml;
      rawText = templateData.compiledText ?? toPlainText(rawHtml);
    } else {
      // TipTap templates need on-the-fly serialization
      const emailComponent = tiptapToReactEmail(
        templateData.content as JSONContent,
        {},
        {
          keepVariablesAsPlaceholders: true,
          brandKit: toBrandKitColors(selectedBrandKit),
        }
      );

      rawHtml = await render(emailComponent);
      rawText = toPlainText(rawHtml);
    }

    // Transform variables for SES compatibility
    // {{contact.email}} → {{contactEmail}}
    // {{contact.firstName|there}} → {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}
    const sesHtml = transformVariablesForSes(rawHtml);
    const sesText = transformVariablesForSes(rawText);
    const sesSubject = transformVariablesForSes(templateData.subject);

    // Generate SES template name
    const sesTemplateName = generateSESTemplateName(
      templateData.id,
      templateData.name
    );

    // Clean up old SES template if name changed (e.g. after a rename)
    if (
      templateData.sesTemplateName &&
      templateData.sesTemplateName !== sesTemplateName
    ) {
      await deleteSESTemplate(
        credentials,
        customerAwsAccount.region,
        templateData.sesTemplateName
      ).catch(() => {}); // Best-effort cleanup
    }

    // Create or update SES template with transformed variables
    await upsertSESTemplate(credentials, customerAwsAccount.region, {
      templateName: sesTemplateName,
      subject: sesSubject,
      htmlPart: sesHtml,
      textPart: sesText,
    });

    // Update template in our database + audit log in one transaction
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(template)
        .set({
          status: "PUBLISHED",
          sesTemplateName,
          publishedAt: now,
          compiledHtml: sesHtml, // Store SES-compatible HTML
          compiledText: sesText,
          updatedAt: now,
        })
        .where(
          and(
            eq(template.id, templateId),
            eq(template.organizationId, organizationId)
          )
        );

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "template.published",
          resource: "template",
          resourceId: templateId,
          metadata: {
            templateId,
            name: templateData.name,
            type: templateData.emailType,
          },
        })
      );
    });

    log.info({ templateId, sesTemplateName }, "Template published to SES");

    // Track activation event (fire-and-forget)
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session?.user?.email) {
        await trackTemplatePublished(session.user.email, organizationId);
      }
    } catch {
      // tracking should never fail the publish
    }

    return { success: true, sesTemplateName };
  } catch (error) {
    log.error({ err: error, templateId }, "Failed to publish template to SES");
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bulk delete templates
 *
 * Also deletes from AWS SES for any templates that were published.
 */
export async function bulkDeleteTemplates(
  organizationId: string,
  templateIds: string[]
): Promise<BulkDeleteResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const log = createActionLogger("bulkDeleteTemplates", {
      orgSlug: access.orgSlug,
    });

    const permError = checkPermission(access.role, "templates", ["delete"]);
    if (permError) return permError;

    if (templateIds.length === 0) {
      return { success: false, error: "No templates selected" };
    }

    // Fetch templates to get their SES template names
    const templates = await db.query.template.findMany({
      where: and(
        eq(template.organizationId, organizationId),
        inArray(template.id, templateIds)
      ),
      columns: {
        id: true,
        sesTemplateName: true,
      },
    });

    // Delete from SES for templates that were published
    const templatesWithSES = templates.filter((t) => t.sesTemplateName);
    if (templatesWithSES.length > 0) {
      // Get the organization's AWS account
      const customerAwsAccount = await db.query.awsAccount.findFirst({
        where: eq(awsAccount.organizationId, organizationId),
      });

      if (customerAwsAccount) {
        const credentials = await getOrAssumeRole({
          roleArn: customerAwsAccount.roleArn,
          externalId: customerAwsAccount.externalId,
          region: customerAwsAccount.region,
        });

        // Delete from SES (fire and settle - don't fail the whole operation if SES fails)
        await Promise.allSettled(
          templatesWithSES.map(async (t) => {
            try {
              await deleteSESTemplate(
                credentials,
                customerAwsAccount.region,
                t.sesTemplateName!
              );
              log.info(
                { templateId: t.id, sesTemplateName: t.sesTemplateName },
                "Deleted template from SES"
              );
            } catch (err) {
              log.warn(
                { err, templateId: t.id },
                "Failed to delete template from SES"
              );
            }
          })
        );
      }
    }

    // Delete templates from database + audit log in one transaction
    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx
        .delete(template)
        .where(
          and(
            eq(template.organizationId, organizationId),
            inArray(template.id, templateIds)
          )
        );

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "template.deleted",
          resource: "template",
          metadata: { count: templateIds.length, templateIds },
        })
      );
    });

    // Revalidate
    revalidateTemplates(access.orgSlug);

    return { success: true, count: templateIds.length };
  } catch (error) {
    const log = createActionLogger("bulkDeleteTemplates", {
      orgSlug: organizationId,
    });
    log.error(
      { err: error, count: templateIds.length },
      "Failed to bulk delete templates"
    );
    return { success: false, error: "Failed to delete templates" };
  }
}

/**
 * Bulk update template email type (marketing/transactional)
 */
export async function bulkUpdateTemplateType(
  organizationId: string,
  templateIds: string[],
  emailType: EmailType
): Promise<BulkUpdateTypeResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "templates", ["write"]);
    if (permError) return permError;

    if (templateIds.length === 0) {
      return { success: false, error: "No templates selected" };
    }

    // Validate email type
    if (!["marketing", "transactional"].includes(emailType)) {
      return { success: false, error: "Invalid email type" };
    }

    // Update templates + audit log in one transaction
    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx
        .update(template)
        .set({
          emailType,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(template.organizationId, organizationId),
            inArray(template.id, templateIds)
          )
        );

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "template.type_updated",
          resource: "template",
          metadata: { count: templateIds.length, newType: emailType },
        })
      );
    });

    // Revalidate
    revalidateTemplates(access.orgSlug);

    return { success: true, count: templateIds.length };
  } catch (error) {
    const log = createActionLogger("bulkUpdateTemplateType", {
      orgSlug: organizationId,
    });
    log.error(
      { err: error, count: templateIds.length, emailType },
      "Failed to bulk update template type"
    );
    return { success: false, error: "Failed to update templates" };
  }
}

/**
 * Bulk update template status (DRAFT/PUBLISHED/ARCHIVED)
 *
 * When status = "PUBLISHED", templates are also published to AWS SES.
 * Templates without subjects are skipped for SES publishing.
 */
export async function bulkUpdateTemplateStatus(
  organizationId: string,
  templateIds: string[],
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
): Promise<BulkUpdateStatusResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "templates", ["write"]);
    if (permError) return permError;

    if (templateIds.length === 0) {
      return {
        success: false,
        error: "No templates selected",
      };
    }

    // Validate status
    if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      return { success: false, error: "Invalid status" };
    }

    // For DRAFT or ARCHIVED, just update the status + audit in one transaction
    if (status !== "PUBLISHED") {
      const auditCtx = await getAuditContext();
      await db.transaction(async (tx) => {
        await tx
          .update(template)
          .set({
            status,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(template.organizationId, organizationId),
              inArray(template.id, templateIds)
            )
          );

        await tx.insert(auditLog).values(
          auditLogEntry(auditCtx, {
            organizationId,
            actorId: access.userId,
            actorEmail: access.userEmail,
            action: "template.status_updated",
            resource: "template",
            metadata: { count: templateIds.length, newStatus: status },
          })
        );
      });

      revalidateTemplates(access.orgSlug);

      return {
        success: true,
        updated: templateIds.length,
        published: 0,
        skipped: [],
        errors: [],
      };
    }

    // For PUBLISHED, we need to publish each template to SES
    // Fetch all templates to check for subjects
    const templates = await db.query.template.findMany({
      where: and(
        eq(template.organizationId, organizationId),
        inArray(template.id, templateIds)
      ),
    });

    // Separate templates with and without subjects
    const templatesWithSubject = templates.filter((t) => !!t.subject);
    const templatesWithoutSubject = templates.filter((t) => !t.subject);
    const skipped = templatesWithoutSubject.map((t) => t.name);

    // Update status to PUBLISHED for templates without subjects (they still get the status)
    if (templatesWithoutSubject.length > 0) {
      await db
        .update(template)
        .set({
          status: "PUBLISHED",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(template.organizationId, organizationId),
            inArray(
              template.id,
              templatesWithoutSubject.map((t) => t.id)
            )
          )
        );
    }

    // Publish templates with subjects to SES
    const publishResults = await Promise.allSettled(
      templatesWithSubject.map((t) =>
        publishTemplateToSES(t.id, organizationId)
      )
    );

    // Collect results
    const errors: string[] = [];
    let publishedCount = 0;

    for (let i = 0; i < publishResults.length; i++) {
      const result = publishResults[i];
      const templateName = templatesWithSubject[i].name;

      if (result.status === "rejected") {
        errors.push(templateName);
      } else if (result.value.success) {
        publishedCount++;
      } else {
        errors.push(templateName);
      }
    }

    // Write audit log for the overall bulk status update
    const auditCtx = await getAuditContext();
    await db.insert(auditLog).values(
      auditLogEntry(auditCtx, {
        organizationId,
        actorId: access.userId,
        actorEmail: access.userEmail,
        action: "template.status_updated",
        resource: "template",
        metadata: { count: templates.length, newStatus: status },
      })
    );

    revalidateTemplates(access.orgSlug);

    return {
      success: true,
      updated: templates.length,
      published: publishedCount,
      skipped,
      errors,
    };
  } catch (error) {
    const log = createActionLogger("bulkUpdateTemplateStatus", {
      orgSlug: organizationId,
    });
    log.error(
      { err: error, count: templateIds.length, status },
      "Failed to bulk update template status"
    );
    return { success: false, error: "Failed to update templates" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPTAP → REACT-EMAIL CONVERSION (JIT on template open)
// ═══════════════════════════════════════════════════════════════════════════

export type ConvertTemplateResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Convert a TipTap email template to react-email format.
 *
 * Called automatically when a user opens a legacy TipTap email template.
 * Non-destructive: keeps original TipTap `content` column, adds compiledHtml,
 * and flips sourceFormat to "react-email".
 *
 * Idempotent: no-ops if already converted or not a TipTap email template.
 */
export async function convertTiptapTemplate(
  organizationId: string,
  templateId: string
): Promise<ConvertTemplateResult> {
  const access = await verifyOrgAccess(organizationId);
  if (!access) {
    return { success: false, error: "No access" };
  }
  const permError = checkPermission(access.role, "templates", ["write"]);
  if (permError) return permError;

  const log = createActionLogger("convertTiptapTemplate", {
    orgSlug: access.orgSlug,
  });

  const auditCtx = await getAuditContext();

  try {
    const templateData = await db.query.template.findFirst({
      where: and(
        eq(template.id, templateId),
        eq(template.organizationId, organizationId)
      ),
    });

    if (!templateData) {
      return { success: false, error: "Template not found" };
    }

    // Only convert tiptap email templates
    if (
      templateData.sourceFormat !== "tiptap" ||
      templateData.channel !== "email"
    ) {
      return { success: true };
    }

    // Fetch default brand kit for styling
    const selectedBrandKit = await db.query.brandKit.findFirst({
      where: and(
        eq(brandKit.organizationId, organizationId),
        eq(brandKit.isDefault, true)
      ),
    });

    const emailComponent = tiptapToReactEmail(
      templateData.content as JSONContent,
      {},
      {
        keepVariablesAsPlaceholders: true,
        brandKit: toBrandKitColors(selectedBrandKit),
      }
    );

    const compiledHtml = await render(emailComponent);
    const compiledText = toPlainText(compiledHtml);

    // Extract variables from rendered HTML ({{variableName}} or {{name|fallback}})
    const variableRegex = /\{\{([^}|]+?)(?:\|([^}]*))?\}\}/g;
    const variables: Array<{ name: string; fallback?: string }> = [];
    const seen = new Set<string>();
    let match = variableRegex.exec(compiledHtml);

    while (match !== null) {
      const name = match[1].trim();
      const fallback = match[2]?.trim();
      if (!seen.has(name)) {
        seen.add(name);
        variables.push(fallback ? { name, fallback } : { name });
      }
      match = variableRegex.exec(compiledHtml);
    }

    // Update template + write audit log in one transaction
    await db.transaction(async (tx) => {
      await tx
        .update(template)
        .set({
          sourceFormat: "react-email",
          compiledHtml,
          compiledText,
          variables,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(template.id, templateId),
            eq(template.organizationId, organizationId)
          )
        );

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "template.converted",
          resource: "template",
          resourceId: templateId,
          metadata: { templateId },
        })
      );
    });

    log.info({ templateId }, "Converted TipTap template to react-email");
    return { success: true };
  } catch (error) {
    log.error({ err: error, templateId }, "Failed to convert TipTap template");
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
