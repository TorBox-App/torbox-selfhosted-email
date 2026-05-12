import { auth } from "@wraps/auth";
import { auditLog, db, reusableBlock } from "@wraps/db";
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

// GET /api/[orgSlug]/blocks/[id] - Get single block
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

    const block = await db.query.reusableBlock.findFirst({
      where: and(
        eq(reusableBlock.id, id),
        eq(reusableBlock.organizationId, orgWithMembership.id)
      ),
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

    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    return NextResponse.json(block);
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/blocks/[id]",
      method: "GET",
    });
    log.error({ err: serializeError(error) }, "Error fetching block");
    return NextResponse.json(
      { error: "Failed to fetch block" },
      { status: 500 }
    );
  }
}

// PUT /api/[orgSlug]/blocks/[id] - Update block
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

    const { name, content, category, description } = await request.json();

    const auditCtx = await getAuditContext();

    const [updated] = await db.transaction(async (tx) => {
      const [r] = await tx
        .update(reusableBlock)
        .set({
          ...(name && { name: name.trim() }),
          ...(content && { content }),
          ...(category && { category }),
          ...(description !== undefined && {
            description: description?.trim() || null,
          }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reusableBlock.id, id),
            eq(reusableBlock.organizationId, orgWithMembership.id)
          )
        )
        .returning();

      if (r) {
        await tx.insert(auditLog).values(
          auditLogEntry(auditCtx, {
            organizationId: orgWithMembership.id,
            actorId: session.user.id,
            actorEmail: session.user.email,
            action: "block.updated",
            resource: "block",
            resourceId: id,
            metadata: { blockId: id },
          })
        );
      }

      return [r];
    });

    if (!updated) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/blocks/[id]",
      method: "PUT",
    });
    log.error({ err: serializeError(error) }, "Error updating block");
    return NextResponse.json(
      { error: "Failed to update block" },
      { status: 500 }
    );
  }
}

// DELETE /api/[orgSlug]/blocks/[id] - Delete block
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

    const auditCtx = await getAuditContext();

    await db.transaction(async (tx) => {
      await tx
        .delete(reusableBlock)
        .where(
          and(
            eq(reusableBlock.id, id),
            eq(reusableBlock.organizationId, orgWithMembership.id)
          )
        );

      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgWithMembership.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "block.deleted",
          resource: "block",
          resourceId: id,
          metadata: { blockId: id },
        })
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/blocks/[id]",
      method: "DELETE",
    });
    log.error({ err: serializeError(error) }, "Error deleting block");
    return NextResponse.json(
      { error: "Failed to delete block" },
      { status: 500 }
    );
  }
}
