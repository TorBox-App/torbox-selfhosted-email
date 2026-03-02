import { createHash } from "node:crypto";
import { render, toPlainText } from "@react-email/render";
import type { JSONContent } from "@tiptap/core";
import { auth } from "@wraps/auth";
import {
  awsAccount,
  brandKit,
  contact,
  db,
  organizationExtension,
  template,
} from "@wraps/db";
import { WrapsEmail } from "@wraps.dev/email";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { tiptapToReactEmail } from "@/lib/serializers/tiptap-to-react-email";
import {
  generatePreferencesUrl,
  generateUnsubscribeUrl,
} from "@/lib/unsubscribe-token";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// POST /api/[orgSlug]/emails/templates/[id]/send-test - Send test email
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgSlug, id } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify organization membership
    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const {
      recipients,
      subject,
      testData = {},
      from,
      previewText,
      brandKitId,
    } = body as {
      recipients: string[];
      subject: string;
      testData?: Record<string, unknown>;
      from?: string;
      previewText?: string;
      brandKitId?: string;
    };

    // Validate required fields
    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    // Validate email format for all recipients
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(
      (email: string) => !emailRegex.test(email)
    );
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email addresses: ${invalidEmails.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch template
    const templateData = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
    });

    if (!templateData) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Merge template's test data with provided test data
    const mergedTestData: Record<string, unknown> = {
      ...((templateData.testData as Record<string, unknown>) || {}),
      ...testData,
    };

    const isMarketing = templateData.emailType === "marketing";
    const orgId = orgWithMembership.id;
    const templateContent = templateData.content as JSONContent;
    const sourceFormat = templateData.sourceFormat;
    const compiledHtml = templateData.compiledHtml;

    // Fetch brand kit (use specified one or default for org)
    const selectedBrandKit = brandKitId
      ? await db.query.brandKit.findFirst({
          where: and(
            eq(brandKit.id, brandKitId),
            eq(brandKit.organizationId, orgId)
          ),
        })
      : await db.query.brandKit.findFirst({
          where: and(
            eq(brandKit.organizationId, orgId),
            eq(brandKit.isDefault, true)
          ),
        });

    // Render HTML from template + test data (marketing URLs injected per-recipient below)
    async function renderTemplate(
      data: Record<string, unknown>
    ): Promise<{ html: string; text: string }> {
      if (sourceFormat === "react-email" && compiledHtml) {
        let html = compiledHtml;
        for (const [key, value] of Object.entries(data)) {
          html = html.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "g"),
            String(value)
          );
        }
        return { html, text: toPlainText(html) };
      }

      const emailComponent = tiptapToReactEmail(templateContent, data, {
        previewText,
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
      });
      const html = await render(emailComponent);
      return { html, text: toPlainText(html) };
    }

    // For marketing templates, look up an existing contact and generate
    // real unsubscribe/preference URLs. Returns null if the recipient
    // isn't an existing contact (no side-effect contact creation).
    async function getMarketingUrls(recipientEmail: string) {
      const emailHash = createHash("sha256")
        .update(recipientEmail.toLowerCase().trim())
        .digest("hex");

      const contactRecord = await db.query.contact.findFirst({
        where: and(
          eq(contact.organizationId, orgId),
          eq(contact.emailHash, emailHash)
        ),
        columns: { id: true },
      });

      if (!contactRecord) {
        return null;
      }

      const [unsubscribeUrl, preferencesUrl] = await Promise.all([
        generateUnsubscribeUrl(contactRecord.id, orgId),
        generatePreferencesUrl(contactRecord.id, orgId),
      ]);

      return { unsubscribeUrl, preferencesUrl };
    }

    // Get the organization's AWS account
    const customerAwsAccount = await db.query.awsAccount.findFirst({
      where: eq(awsAccount.organizationId, orgId),
    });

    if (!customerAwsAccount) {
      return NextResponse.json(
        {
          error:
            "No AWS account connected. Please connect an AWS account first.",
        },
        { status: 400 }
      );
    }

    // Get credentials for the customer's AWS account
    const credentials = await getOrAssumeRole({
      roleArn: customerAwsAccount.roleArn,
      externalId: customerAwsAccount.externalId,
      region: customerAwsAccount.region,
    });

    // Initialize Wraps SDK with the org's credentials
    const wraps = new WrapsEmail({
      region: customerAwsAccount.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    // Resolve sender from request body, then org defaults
    let senderEmail = from;
    let senderName: string | undefined;

    if (!senderEmail) {
      const orgExtension = await db.query.organizationExtension.findFirst({
        where: eq(organizationExtension.organizationId, orgId),
      });
      senderEmail = orgExtension?.defaultFrom ?? undefined;
      senderName = orgExtension?.defaultFromName ?? undefined;
    }

    if (!senderEmail) {
      return NextResponse.json(
        {
          error:
            "No sender email configured. Set a default sender in Settings > Sender Defaults, or provide a 'from' address.",
        },
        { status: 400 }
      );
    }

    // Send to each recipient (marketing URLs generated per-recipient)
    const warnings: string[] = [];
    const results = await Promise.allSettled(
      recipients.map(async (recipient: string) => {
        const recipientData = { ...mergedTestData };

        if (isMarketing) {
          const marketingUrls = await getMarketingUrls(recipient);
          if (marketingUrls) {
            recipientData.unsubscribeUrl = marketingUrls.unsubscribeUrl;
            recipientData.preferencesUrl = marketingUrls.preferencesUrl;
          } else {
            warnings.push(
              `${recipient} is not an existing contact — unsubscribe and preference center links will not work in this test send.`
            );
          }
        }

        const { html, text } = await renderTemplate(recipientData);

        const fromAddress = senderName
          ? `${senderName} <${senderEmail}>`
          : senderEmail;
        const result = await wraps.send({
          from: fromAddress,
          to: recipient,
          subject,
          html,
          text,
        });
        return { recipient, messageId: result.messageId };
      })
    );

    // Process results
    const successful: string[] = [];
    const failed: { recipient: string; error: string }[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const recipient = recipients[i];

      if (result.status === "fulfilled") {
        successful.push(recipient);
      } else {
        failed.push({
          recipient,
          error: result.reason?.message || "Failed to send",
        });
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      sent: successful.length,
      failed: failed.length,
      warnings,
      details: {
        successful,
        failed,
      },
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]/send-test",
      method: "POST",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error sending test email");
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send test email",
      },
      { status: 500 }
    );
  }
}
