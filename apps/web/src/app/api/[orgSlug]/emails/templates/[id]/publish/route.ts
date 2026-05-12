import { toPlainText } from "@react-email/render";
import { auth } from "@wraps/auth";
import { auditLog, awsAccount, db, template } from "@wraps/db";
import {
  deleteSESTemplate,
  generateSESTemplateName,
  transformVariablesForSes,
  upsertSESTemplate,
} from "@wraps/email";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// POST /api/[orgSlug]/emails/templates/[id]/publish - Publish template to SES
export async function POST(_request: Request, context: RouteContext) {
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

    // Validate subject is set
    if (!templateData.subject) {
      return NextResponse.json(
        {
          error:
            "Template subject is required for publishing. Please set a subject line.",
        },
        { status: 400 }
      );
    }

    // Get the organization's AWS account
    const customerAwsAccount = await db.query.awsAccount.findFirst({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
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

    if (!templateData.compiledHtml) {
      return NextResponse.json(
        {
          error:
            "Template must be compiled before publishing. Open it in the editor first.",
        },
        { status: 400 }
      );
    }

    const rawHtml = templateData.compiledHtml;
    const rawText = templateData.compiledText ?? toPlainText(rawHtml);

    // Transform variables for SES compatibility
    // {{contact.email}} → {{contactEmail}}
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

    // Update template + audit log atomically
    // (SES upsert already succeeded above — DB is the source of truth)
    const now = new Date();
    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx
        .update(template)
        .set({
          status: "PUBLISHED",
          sesTemplateName,
          publishedAt: now,
          compiledHtml: sesHtml,
          compiledText: sesText,
          updatedAt: now,
        })
        .where(
          and(
            eq(template.id, id),
            eq(template.organizationId, orgWithMembership.id)
          )
        );
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgWithMembership.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "template.published",
          resource: "template",
          resourceId: id,
          metadata: {
            templateId: id,
            name: templateData.name,
            sesTemplateName,
          },
        })
      );
    });

    return NextResponse.json({
      success: true,
      sesTemplateName,
      publishedAt: now.toISOString(),
      message: `Template published to SES as "${sesTemplateName}"`,
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]/publish",
      method: "POST",
      orgSlug,
    });
    log.error({ err: error }, "Error publishing template");
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to publish template",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/[orgSlug]/emails/templates/[id]/publish - Unpublish template from SES
export async function DELETE(_request: Request, context: RouteContext) {
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

    if (!templateData.sesTemplateName) {
      return NextResponse.json(
        { error: "Template is not published to SES" },
        { status: 400 }
      );
    }

    // Get the organization's AWS account
    const customerAwsAccount = await db.query.awsAccount.findFirst({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
    });

    if (!customerAwsAccount) {
      return NextResponse.json(
        { error: "No AWS account connected" },
        { status: 400 }
      );
    }

    // Get credentials for the customer's AWS account
    const credentials = await getOrAssumeRole({
      roleArn: customerAwsAccount.roleArn,
      externalId: customerAwsAccount.externalId,
      region: customerAwsAccount.region,
    });

    // Delete SES template
    await deleteSESTemplate(
      credentials,
      customerAwsAccount.region,
      templateData.sesTemplateName
    );

    // Update template + audit log atomically
    const now = new Date();
    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx
        .update(template)
        .set({
          status: "DRAFT",
          sesTemplateName: null,
          publishedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(template.id, id),
            eq(template.organizationId, orgWithMembership.id)
          )
        );
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgWithMembership.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "template.unpublished",
          resource: "template",
          resourceId: id,
          metadata: { templateId: id, name: templateData.name },
        })
      );
    });

    return NextResponse.json({
      success: true,
      message: "Template unpublished from SES",
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]/publish",
      method: "DELETE",
      orgSlug,
    });
    log.error({ err: error }, "Error unpublishing template");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to unpublish template",
      },
      { status: 500 }
    );
  }
}
