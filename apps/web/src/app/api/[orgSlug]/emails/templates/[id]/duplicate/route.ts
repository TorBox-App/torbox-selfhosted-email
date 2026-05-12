import { auth } from "@wraps/auth";
import { auditLog, db, template } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// POST /api/[orgSlug]/emails/templates/[id]/duplicate - Duplicate template
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

    // Get the original template
    const original = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
    });

    if (!original) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const auditCtx = await getAuditContext();

    // Create duplicate + write audit log in one transaction
    const [duplicated] = await db.transaction(async (tx) => {
      const [r] = await tx
        .insert(template)
        .values({
          organizationId: orgWithMembership.id,
          name: `${original.name} (Copy)`,
          description: original.description,
          subject: original.subject,
          emailType: original.emailType,
          content: original.content,
          variables: original.variables,
          testData: original.testData,
          source: original.source,
          sourceFormat: original.sourceFormat,
          compiledHtml: original.compiledHtml,
          compiledText: original.compiledText,
          aiGenerated: original.aiGenerated,
          createdBy: session.user.id,
          status: "DRAFT",
        })
        .returning();

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgWithMembership.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "template.duplicated",
          resource: "template",
          resourceId: id,
          metadata: { originalTemplateId: id, newTemplateId: r.id },
        })
      );

      return [r];
    });

    return NextResponse.json(duplicated, { status: 201 });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails/templates/[id]/duplicate",
      method: "POST",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error duplicating template");
    return NextResponse.json(
      { error: "Failed to duplicate template" },
      { status: 500 }
    );
  }
}
