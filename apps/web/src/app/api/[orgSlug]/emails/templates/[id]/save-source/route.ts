import { createHash } from "node:crypto";
import { auth } from "@wraps/auth";
import { db, template } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    id: string;
  }>;
};

// POST /api/[orgSlug]/emails/templates/[id]/save-source - Save edited source + compiled output
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;
  const log = createRequestLogger({
    path: `/api/${orgSlug}/emails/templates/${id}/save-source`,
    method: "POST",
    orgSlug,
  });

  try {
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

    // Verify template exists and is a code template
    const existing = await db.query.template.findFirst({
      where: and(
        eq(template.id, id),
        eq(template.organizationId, orgWithMembership.id)
      ),
      columns: { id: true, sourceFormat: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (existing.sourceFormat !== "react-email") {
      return NextResponse.json(
        { error: "Only react-email templates can be saved via this endpoint" },
        { status: 400 }
      );
    }

    const {
      source,
      compiledHtml,
      compiledText,
      variables,
    }: {
      source: string;
      compiledHtml: string;
      compiledText: string;
      variables: Array<{ name: string; fallback?: string }>;
    } = await request.json();

    if (!source || !compiledHtml) {
      return NextResponse.json(
        { error: "source and compiledHtml are required" },
        { status: 400 }
      );
    }

    // Compute source hash
    const sourceHash = createHash("sha256").update(source).digest("hex");

    // Update template
    const now = new Date();
    const [updated] = await db
      .update(template)
      .set({
        source,
        sourceHash,
        compiledHtml,
        compiledText,
        variables: (variables ?? []) as Record<string, unknown>[],
        lastEditedFrom: "dashboard",
        lastEditedBy: session.user.id,
        updatedAt: now,
      })
      .where(eq(template.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      template: updated,
    });
  } catch (error) {
    log.error({ err: serializeError(error) }, "Failed to save template source");
    return NextResponse.json(
      { error: "Failed to save template source" },
      { status: 500 }
    );
  }
}
