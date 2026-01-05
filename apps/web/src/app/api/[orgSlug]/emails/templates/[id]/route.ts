import { render, toPlainText } from "@react-email/render";
import type { JSONContent } from "@tiptap/core";
import { auth } from "@wraps/auth";
import { brandKit, db, template, templateVersion } from "@wraps/db";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { tiptapToReactEmail } from "@/lib/serializers/tiptap-to-react-email";

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

    const body = await request.json();
    const {
      content,
      name,
      description,
      subject,
      emailType,
      status,
      variables,
      testData,
    } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      lastEditedBy: session.user.id,
    };

    if (content !== undefined) {
      updateData.content = content;

      // Auto-compile HTML for broadcasts (without pushing to SES)
      try {
        // Fetch default brand kit for styling
        const defaultBrandKit = await db.query.brandKit.findFirst({
          where: and(
            eq(brandKit.organizationId, orgWithMembership.id),
            eq(brandKit.isDefault, true)
          ),
        });

        // Convert TipTap content to React Email component
        const emailComponent = tiptapToReactEmail(
          content as JSONContent,
          {}, // Empty data - variables stay as placeholders
          {
            keepVariablesAsPlaceholders: true,
            brandKit: defaultBrandKit
              ? {
                  primaryColor: defaultBrandKit.primaryColor,
                  secondaryColor: defaultBrandKit.secondaryColor,
                  backgroundColor: defaultBrandKit.backgroundColor,
                  textColor: defaultBrandKit.textColor,
                  fontFamily: defaultBrandKit.fontFamily,
                  headingFontFamily:
                    defaultBrandKit.headingFontFamily ?? undefined,
                  buttonRadius: defaultBrandKit.buttonRadius,
                }
              : undefined,
          }
        );

        // Render to HTML
        const compiledHtml = await render(emailComponent);

        // Generate plain text version using react-email's robust converter
        const compiledText = toPlainText(compiledHtml);

        updateData.compiledHtml = compiledHtml;
        updateData.compiledText = compiledText;
      } catch (compileError) {
        // Log but don't fail the save - template content is still saved
        const log = createRequestLogger({
          path: "/api/[orgSlug]/emails/templates/[id]",
          method: "PUT",
          orgSlug,
        });
        log.warn(
          { err: serializeError(compileError) },
          "Failed to compile template HTML"
        );
      }
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
      const { createVersion } = body;

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

    // Delete template (versions will cascade)
    const [deleted] = await db
      .delete(template)
      .where(
        and(
          eq(template.id, id),
          eq(template.organizationId, orgWithMembership.id)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

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
