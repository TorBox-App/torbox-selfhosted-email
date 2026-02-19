"use server";

import { auth } from "@wraps/auth";
import { buildConditionSQL, contact, db, segment } from "@wraps/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createActionLogger, serializeError } from "@/lib/logger";
import { checkFeatureAccess } from "@/lib/plan-limits";
import {
  type CreateSegmentResult,
  type DeleteSegmentResult,
  type FilterCondition,
  type GetSegmentResult,
  type ListSegmentsResult,
  type PreviewSegmentResult,
  type UpdateSegmentResult,
  validateCondition,
} from "@/lib/segments";

// Re-export types for convenience
export type {
  CreateSegmentResult,
  DeleteSegmentResult,
  GetSegmentResult,
  ListSegmentsResult,
  PreviewSegmentResult,
  SegmentWithMeta,
  UpdateSegmentResult,
} from "@/lib/segments";

/**
 * Verify user has access to organization
 */
async function verifyOrgAccess(
  organizationId: string
): Promise<{ userId: string; role: string } | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const membership = await db.query.member.findFirst({
    where: (m, { and, eq }) =>
      and(eq(m.organizationId, organizationId), eq(m.userId, session.user.id)),
  });

  if (!membership) {
    return null;
  }

  return { userId: session.user.id, role: membership.role };
}

/**
 * List all segments for an organization
 */
export async function listSegments(
  organizationId: string
): Promise<ListSegmentsResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const segments = await db
      .select()
      .from(segment)
      .where(eq(segment.organizationId, organizationId))
      .orderBy(desc(segment.createdAt));

    return {
      success: true,
      segments: segments.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        condition: s.condition,
        trackMembership: s.trackMembership,
        memberCount: s.memberCount,
        lastComputedAt: s.lastComputedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        createdBy: null, // TODO: join with user table if needed
      })),
    };
  } catch (error) {
    const log = createActionLogger("listSegments", { orgSlug: organizationId });
    log.error({ err: serializeError(error) }, "Failed to list segments");
    return { success: false, error: "Failed to fetch segments" };
  }
}

/**
 * Get a single segment by ID
 */
export async function getSegment(
  segmentId: string,
  organizationId: string
): Promise<GetSegmentResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const [s] = await db
      .select()
      .from(segment)
      .where(
        and(
          eq(segment.id, segmentId),
          eq(segment.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!s) {
      return { success: false, error: "Segment not found" };
    }

    return {
      success: true,
      segment: {
        id: s.id,
        name: s.name,
        description: s.description,
        condition: s.condition,
        trackMembership: s.trackMembership,
        memberCount: s.memberCount,
        lastComputedAt: s.lastComputedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        createdBy: null, // TODO: join with user table if needed
      },
    };
  } catch (error) {
    const log = createActionLogger("getSegment", { orgSlug: organizationId });
    log.error(
      { err: serializeError(error), segmentId },
      "Failed to get segment"
    );
    return { success: false, error: "Failed to fetch segment" };
  }
}

/**
 * Create a new segment
 */
export async function createSegment(
  organizationId: string,
  data: {
    name: string;
    description?: string;
    condition: FilterCondition;
    trackMembership?: boolean;
  }
): Promise<CreateSegmentResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Only owners and admins can create segments
    if (!["owner", "admin"].includes(access.role)) {
      return {
        success: false,
        error: "Only owners and admins can create segments",
      };
    }

    // Check if segments feature is available for this plan (Starter+)
    const featureCheck = await checkFeatureAccess(organizationId, "segments");
    if (!featureCheck.allowed) {
      return {
        success: false,
        error: featureCheck.message ?? "Segments require a paid plan.",
      };
    }

    // Validate name
    if (!data.name || data.name.trim().length < 1) {
      return { success: false, error: "Segment name is required" };
    }

    // Validate condition
    const conditionError = validateCondition(data.condition);
    if (conditionError) {
      return { success: false, error: conditionError };
    }

    // Compute initial member count
    const conditionSQL = buildConditionSQL(data.condition);
    let memberCount = 0;

    if (conditionSQL) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contact)
        .where(and(eq(contact.organizationId, organizationId), conditionSQL));
      memberCount = countResult?.count ?? 0;
    }

    // Create segment
    const [newSegment] = await db
      .insert(segment)
      .values({
        organizationId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        condition: data.condition,
        trackMembership: data.trackMembership ?? false,
        memberCount,
        lastComputedAt: new Date(),
        createdBy: access.userId,
      })
      .returning();

    if (!newSegment) {
      return { success: false, error: "Failed to create segment" };
    }

    // Revalidate
    revalidatePath("/[orgSlug]/segments", "page");

    // Return the created segment
    return await getSegment(newSegment.id, organizationId);
  } catch (error) {
    const log = createActionLogger("createSegment", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to create segment");
    return { success: false, error: "Failed to create segment" };
  }
}

/**
 * Update a segment
 */
export async function updateSegment(
  segmentId: string,
  organizationId: string,
  data: {
    name?: string;
    description?: string | null;
    condition?: FilterCondition;
    trackMembership?: boolean;
  }
): Promise<UpdateSegmentResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Only owners and admins can update segments
    if (!["owner", "admin"].includes(access.role)) {
      return {
        success: false,
        error: "Only owners and admins can update segments",
      };
    }

    // Verify segment exists
    const [existing] = await db
      .select()
      .from(segment)
      .where(
        and(
          eq(segment.id, segmentId),
          eq(segment.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: "Segment not found" };
    }

    // Build update data
    const updateData: Partial<typeof segment.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < 1) {
        return { success: false, error: "Segment name is required" };
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.condition !== undefined) {
      const conditionError = validateCondition(data.condition);
      if (conditionError) {
        return { success: false, error: conditionError };
      }
      updateData.condition = data.condition;

      // Recompute member count
      const conditionSQL = buildConditionSQL(data.condition);
      if (conditionSQL) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(contact)
          .where(and(eq(contact.organizationId, organizationId), conditionSQL));
        updateData.memberCount = countResult?.count ?? 0;
      }
      updateData.lastComputedAt = new Date();
    }

    if (data.trackMembership !== undefined) {
      updateData.trackMembership = data.trackMembership;
    }

    // Update segment
    await db
      .update(segment)
      .set(updateData)
      .where(
        and(
          eq(segment.id, segmentId),
          eq(segment.organizationId, organizationId)
        )
      );

    // Revalidate
    revalidatePath("/[orgSlug]/segments", "page");

    // Return updated segment
    return await getSegment(segmentId, organizationId);
  } catch (error) {
    const log = createActionLogger("updateSegment", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), segmentId },
      "Failed to update segment"
    );
    return { success: false, error: "Failed to update segment" };
  }
}

/**
 * Delete a segment
 */
export async function deleteSegment(
  segmentId: string,
  organizationId: string
): Promise<DeleteSegmentResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Only owners and admins can delete segments
    if (!["owner", "admin"].includes(access.role)) {
      return {
        success: false,
        error: "Only owners and admins can delete segments",
      };
    }

    // Verify segment exists
    const [existing] = await db
      .select()
      .from(segment)
      .where(
        and(
          eq(segment.id, segmentId),
          eq(segment.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: "Segment not found" };
    }

    // Delete segment
    await db
      .delete(segment)
      .where(
        and(
          eq(segment.id, segmentId),
          eq(segment.organizationId, organizationId)
        )
      );

    // Revalidate
    revalidatePath("/[orgSlug]/segments", "page");

    return { success: true };
  } catch (error) {
    const log = createActionLogger("deleteSegment", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), segmentId },
      "Failed to delete segment"
    );
    return { success: false, error: "Failed to delete segment" };
  }
}

/**
 * Preview segment - count matching contacts and return sample emails
 */
export async function previewSegment(
  organizationId: string,
  condition: FilterCondition
): Promise<PreviewSegmentResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Validate condition
    const conditionError = validateCondition(condition);
    if (conditionError) {
      return { success: false, error: conditionError };
    }

    const conditionSQL = buildConditionSQL(condition);

    if (!conditionSQL) {
      return { success: true, count: 0, sampleEmails: [] };
    }

    // Get count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contact)
      .where(and(eq(contact.organizationId, organizationId), conditionSQL));

    const count = countResult?.count ?? 0;

    // Get sample emails (up to 5)
    const samples = await db
      .select({ email: contact.email })
      .from(contact)
      .where(and(eq(contact.organizationId, organizationId), conditionSQL))
      .limit(5);

    return {
      success: true,
      count,
      sampleEmails: samples
        .map((s) => s.email)
        .filter((e): e is string => e !== null),
    };
  } catch (error) {
    const log = createActionLogger("previewSegment", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to preview segment");
    return { success: false, error: "Failed to preview segment" };
  }
}

/**
 * Get unique property keys from contacts
 */
export type GetPropertyKeysResult =
  | { success: true; keys: string[] }
  | { success: false; error: string };

export async function getPropertyKeys(
  organizationId: string
): Promise<GetPropertyKeysResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const rows = await db.execute<{ key: string }>(
      sql`SELECT DISTINCT json_object_keys(${contact.properties}) AS key
          FROM ${contact}
          WHERE ${contact.organizationId} = ${organizationId}
            AND ${contact.properties} IS NOT NULL`
    );

    const keys = rows.rows.map((r) => r.key).sort();

    return { success: true, keys };
  } catch (error) {
    const log = createActionLogger("getPropertyKeys", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to get property keys");
    return { success: true, keys: [] };
  }
}

/**
 * Recompute segment member counts (can be called periodically or on-demand)
 */
export async function recomputeSegmentCounts(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    // Get all segments for org
    const segments = await db
      .select()
      .from(segment)
      .where(eq(segment.organizationId, organizationId));

    // Recompute counts for each segment
    for (const seg of segments) {
      const conditionSQL = buildConditionSQL(seg.condition);

      if (conditionSQL) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(contact)
          .where(and(eq(contact.organizationId, organizationId), conditionSQL));

        await db
          .update(segment)
          .set({
            memberCount: countResult?.count ?? 0,
            lastComputedAt: new Date(),
          })
          .where(eq(segment.id, seg.id));
      }
    }

    // Revalidate
    revalidatePath("/[orgSlug]/segments", "page");

    return { success: true };
  } catch (error) {
    const log = createActionLogger("recomputeSegmentCounts", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error) },
      "Failed to recompute segment counts"
    );
    return { success: false, error: "Failed to recompute segment counts" };
  }
}
