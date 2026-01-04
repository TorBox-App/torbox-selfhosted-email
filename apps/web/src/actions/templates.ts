"use server";

import { render } from "@react-email/render";
import type { JSONContent } from "@tiptap/core";
import { awsAccount, brandKit, db, template } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import {
  generateSESTemplateName,
  upsertSESTemplate,
} from "@/lib/aws/ses-templates";
import { createActionLogger, serializeError } from "@/lib/logger";
import { tiptapToReactEmail } from "@/lib/serializers/tiptap-to-react-email";
import { transformVariablesForSes } from "@/lib/ses-variables";

export type PublishTemplateResult =
  | { success: true; sesTemplateName: string }
  | { success: false; error: string };

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
  const log = createActionLogger("publishTemplateToSES", {
    orgSlug: organizationId,
  });

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

    // Convert TipTap content to React Email component
    // Note: For SES templates, we keep variables as {{variableName}} for SES to substitute
    const emailComponent = tiptapToReactEmail(
      templateData.content as JSONContent,
      {}, // Empty data - variables will be substituted by SES
      {
        keepVariablesAsPlaceholders: true, // Always render {{name}} for SES
        brandKit: selectedBrandKit
          ? {
              primaryColor: selectedBrandKit.primaryColor,
              secondaryColor: selectedBrandKit.secondaryColor,
              backgroundColor: selectedBrandKit.backgroundColor,
              textColor: selectedBrandKit.textColor,
              fontFamily: selectedBrandKit.fontFamily,
              headingFontFamily:
                selectedBrandKit.headingFontFamily ?? undefined,
              buttonRadius: selectedBrandKit.buttonRadius,
            }
          : undefined,
      }
    );

    // Render to HTML
    const rawHtml = await render(emailComponent);

    // Generate plain text version
    const rawText = rawHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

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

    // Create or update SES template with transformed variables
    await upsertSESTemplate(credentials, customerAwsAccount.region, {
      templateName: sesTemplateName,
      subject: sesSubject,
      htmlPart: sesHtml,
      textPart: sesText,
    });

    // Update template in our database
    // Store the SES-transformed HTML for consistency
    const now = new Date();
    await db
      .update(template)
      .set({
        status: "PUBLISHED",
        sesTemplateName,
        publishedAt: now,
        compiledHtml: sesHtml, // Store SES-compatible HTML
        compiledText: sesText,
        updatedAt: now,
      })
      .where(eq(template.id, templateId));

    log.info({ templateId, sesTemplateName }, "Template published to SES");

    return { success: true, sesTemplateName };
  } catch (error) {
    log.error(
      { err: serializeError(error), templateId },
      "Failed to publish template to SES"
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to publish template",
    };
  }
}
