import { auth } from "@wraps/auth";
import { awsAccount, db, template, templateVersion } from "@wraps/db";
import { deleteSESTemplate } from "@wraps/email";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

const updateTemplateSchema = z
  .object({
    content: z.record(z.string(), z.unknown()).optional(),
    name: z.string().max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    subject: z.string().max(500).nullable().optional(),
    previewText: z.string().max(500).nullable().optional(),
    emailType: z.enum(["marketing", "transactional"]).optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    variables: z.array(z.record(z.string(), z.unknown())).optional(),
    testData: z.record(z.string(), z.unknown()).optional(),
    compiledText: z.string().max(10_000).optional(),
    createVersion: z.boolean().optional(),
    brandKitId: z.string().nullable().optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// GET /api/[orgSlug]/emails/templates/[id] - Get single template
export async function GET(_request: Request, context: RouteContext) {
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

    const result = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        lastEditedByUser: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        versions: {
          limit: 10,
          orderBy: [desc(templateVersion.createdAt)],
        },
      },
    });

    if (!result) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]",
      method: "GET",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error fetching template");
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

// PUT /api/[orgSlug]/emails/templates/[id] - Update template
export async function PUT(request: Request, context: RouteContext) {
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

    const rawBody = await request.json();
    const parsed = updateTemplateSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      content,
      name,
      description,
      subject,
      previewText,
      emailType,
      status,
      variables,
      testData,
      compiledText,
      createVersion,
      brandKitId,
    } = parsed.data;

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      lastEditedBy: session.user.id,
    };

    if (content !== undefined) {
      updateData.content = content;
    }
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (subject !== undefined) {
      updateData.subject = subject?.trim() || null;
    }
    if (previewText !== undefined) {
      updateData.previewText = previewText?.trim() || null;
    }
    if (emailType !== undefined) {
      updateData.emailType = emailType;
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    if (variables !== undefined) {
      updateData.variables = variables;
    }
    if (testData !== undefined) {
      updateData.testData = testData;
    }
    if (compiledText !== undefined && typeof compiledText === "string") {
      updateData.compiledText = compiledText;
    }
    if (brandKitId !== undefined) {
      updateData.brandKitId = brandKitId;
    }

    // Update template
    const [updated] = await db
      .update(template)
      .set(updateData)
      .where(
        and(
          eq(template.id, id),
          eq(template.organizationId, orgWithMembership.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Create version snapshot if content was updated
    // Only create a version if:
    // 1. It's a manual save (createVersion: true)
    // 2. OR it's been more than 5 minutes since the last version
    if (content !== undefined) {
      // Get the most recent version
      const versions = await db.query.templateVersion.findMany({
        where: eq(templateVersion.templateId, id),
        orderBy: [desc(templateVersion.version)],
        limit: 1,
      });

      const lastVersion = versions[0];
      const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

      // Check if we should create a version
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const shouldCreateVersion =
        createVersion === true || // Manual save
        !lastVersion || // No versions yet
        new Date(lastVersion.createdAt) < fiveMinutesAgo; // Last version is old enough

      if (shouldCreateVersion) {
        await db.insert(templateVersion).values({
          templateId: id,
          content,
          version: nextVersion,
          createdBy: session.user.id,
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]",
      method: "PUT",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error updating template");
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE /api/[orgSlug]/emails/templates/[id] - Delete template
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

    // Fetch the template to check for SES template name
    const existingTemplate = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
      columns: { id: true, sesTemplateName: true },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Delete from SES if published
    if (existingTemplate.sesTemplateName) {
      const customerAwsAccount = await db.query.awsAccount.findFirst({
        where: eq(awsAccount.organizationId, orgWithMembership.id),
      });

      if (customerAwsAccount) {
        const credentials = await getOrAssumeRole({
          roleArn: customerAwsAccount.roleArn,
          externalId: customerAwsAccount.externalId,
          region: customerAwsAccount.region,
        });

        try {
          await deleteSESTemplate(
            credentials,
            customerAwsAccount.region,
            existingTemplate.sesTemplateName
          );
        } catch (err) {
          const log = createRequestLogger({
            path: "/api/[orgSlug]/emails/templates/[id]",
            method: "DELETE",
            orgSlug,
          });
          log.warn(
            { err: serializeError(err), templateId: id },
            "Failed to delete template from SES"
          );
        }
      }
    }

    // Delete template from database (versions will cascade)
    await db
      .delete(template)
      .where(
        and(
          eq(template.id, id),
          eq(template.organizationId, orgWithMembership.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]",
      method: "DELETE",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error deleting template");
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
