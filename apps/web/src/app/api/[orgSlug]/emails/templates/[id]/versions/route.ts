import { auth } from "@wraps/auth";
import { auditLog, db, template, templateVersion } from "@wraps/db";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireRoutePermission } from "@/app/api/shared/route-permission";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// GET /api/[orgSlug]/emails/templates/[id]/versions - List all versions
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

    // Verify template exists and belongs to org
    const existingTemplate = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
      columns: { id: true },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Get all versions
    const versions = await db.query.templateVersion.findMany({
      where: eq(templateVersion.templateId, id),
      orderBy: [desc(templateVersion.version)],
      limit: 100,
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(versions);
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]/versions",
      method: "GET",
      orgSlug,
    });
    log.error({ err: error }, "Error fetching versions");
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

// POST /api/[orgSlug]/emails/templates/[id]/versions - Create manual version snapshot
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

    const denied = requireRoutePermission(
      orgWithMembership.userRole,
      "templates",
      ["write"]
    );
    if (denied) return denied;

    const body = await request.json();
    const { changeNote } = body;

    // Get current template
    const existingTemplate = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Get the latest version number
    const versions = await db.query.templateVersion.findMany({
      where: eq(templateVersion.templateId, id),
      orderBy: [desc(templateVersion.version)],
      limit: 1,
    });

    const nextVersion = versions[0] ? versions[0].version + 1 : 1;

    const auditCtx = await getAuditContext();

    // Create new version + write audit log in one transaction
    const [newVersion] = await db.transaction(async (tx) => {
      const [r] = await tx
        .insert(templateVersion)
        .values({
          templateId: id,
          content: existingTemplate.content,
          source: existingTemplate.source,
          compiledHtml: existingTemplate.compiledHtml,
          version: nextVersion,
          createdBy: session.user.id,
          changeNote: changeNote?.trim() || null,
        })
        .returning();

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgWithMembership.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "template.version_created",
          resource: "template",
          resourceId: id,
          metadata: {
            templateId: id,
            version: nextVersion,
            changeNote: changeNote?.trim() || null,
          },
        })
      );

      return [r];
    });

    return NextResponse.json(newVersion);
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]/versions",
      method: "POST",
      orgSlug,
    });
    log.error({ err: error }, "Error creating version");
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}
