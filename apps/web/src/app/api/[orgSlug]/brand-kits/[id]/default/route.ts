import { auth } from "@wraps/auth";
import { auditLog, brandKit, db } from "@wraps/db";
import { and, eq } from "drizzle-orm";
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

// POST /api/[orgSlug]/brand-kits/[id]/default - Set brand kit as default
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

    const denied = requireRoutePermission(
      orgWithMembership.userRole,
      "templates",
      ["write"]
    );
    if (denied) return denied;

    // Check if brand kit exists
    const kit = await db.query.brandKit.findFirst({
      where: and(
        eq(brandKit.id, id),
        eq(brandKit.organizationId, orgWithMembership.id)
      ),
    });

    if (!kit) {
      return NextResponse.json(
        { error: "Brand kit not found" },
        { status: 404 }
      );
    }

    const auditCtx = await getAuditContext();

    // Unset current default, set new default, and write audit log in one transaction
    const [updated] = await db.transaction(async (tx) => {
      await tx
        .update(brandKit)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(brandKit.organizationId, orgWithMembership.id));

      const [r] = await tx
        .update(brandKit)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(
          and(
            eq(brandKit.id, id),
            eq(brandKit.organizationId, orgWithMembership.id)
          )
        )
        .returning();
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgWithMembership.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "brand_kit.set_default",
          resource: "brand_kit",
          resourceId: id,
          metadata: { brandKitId: id, name: kit.name },
        })
      );
      return [r];
    });

    return NextResponse.json(updated);
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/brand-kits/[id]/default",
      method: "POST",
    });
    log.error({ err: error }, "Error setting default brand kit");
    return NextResponse.json(
      { error: "Failed to set default brand kit" },
      { status: 500 }
    );
  }
}
