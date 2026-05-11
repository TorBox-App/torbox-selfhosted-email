import { auth } from "@wraps/auth";
import { auditLog, brandKit, db } from "@wraps/db";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

// GET /api/[orgSlug]/brand-kits - List all brand kits
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

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

    const brandKits = await db.query.brandKit.findMany({
      where: eq(brandKit.organizationId, orgWithMembership.id),
      orderBy: [desc(brandKit.isDefault), desc(brandKit.updatedAt)],
    });

    return NextResponse.json(brandKits);
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/brand-kits",
      method: "GET",
    });
    log.error({ err: serializeError(error) }, "Error fetching brand kits");
    return NextResponse.json(
      { error: "Failed to fetch brand kits" },
      { status: 500 }
    );
  }
}

// POST /api/[orgSlug]/brand-kits - Create new brand kit
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

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

    // If this is the first brand kit, make it default
    const existingKits = await db.query.brandKit.findFirst({
      where: eq(brandKit.organizationId, orgWithMembership.id),
    });

    const isDefault = !existingKits || body.isDefault === true;

    const auditCtx = await getAuditContext();

    // Unset defaults, create brand kit, and write audit log in one transaction
    const [newBrandKit] = await db.transaction(async (tx) => {
      // If setting as default, unset other defaults first
      if (isDefault) {
        await tx
          .update(brandKit)
          .set({ isDefault: false })
          .where(eq(brandKit.organizationId, orgWithMembership.id));
      }

      const [r] = await tx
        .insert(brandKit)
        .values({
          organizationId: orgWithMembership.id,
          name: body.name?.trim() || "Untitled Brand Kit",
          logoUrl: body.logoUrl || null,
          primaryColor: body.primaryColor || "#5046e5",
          secondaryColor: body.secondaryColor || "#6366f1",
          backgroundColor: body.backgroundColor || "#ffffff",
          textColor: body.textColor || "#1f2937",
          fontFamily: body.fontFamily || "system-ui, sans-serif",
          headingFontFamily: body.headingFontFamily || null,
          buttonStyle: body.buttonStyle || "rounded",
          buttonRadius: body.buttonRadius || "4px",
          companyName: body.companyName || null,
          companyAddress: body.companyAddress || null,
          socialLinks: body.socialLinks || [],
          sourceDomain: body.sourceDomain || null,
          autoExtracted: body.autoExtracted,
          isDefault,
        })
        .returning();
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgWithMembership.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "brand_kit.created",
          resource: "brand_kit",
          resourceId: r.id,
          metadata: { brandKitId: r.id, name: r.name },
        })
      );
      return [r];
    });

    return NextResponse.json(newBrandKit, { status: 201 });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/brand-kits",
      method: "POST",
    });
    log.error({ err: serializeError(error) }, "Error creating brand kit");
    return NextResponse.json(
      { error: "Failed to create brand kit" },
      { status: 500 }
    );
  }
}
