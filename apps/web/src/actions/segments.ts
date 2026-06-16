"use server";

import { buildConditionSQL, contact, db, segment } from "@wraps/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
import { orgAction } from "./shared/org-action";

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
 * List all segments for an organization
 */
export const listSegments = orgAction(
  {
    name: "listSegments",
    resource: "segments",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to fetch segments",
  },
  async (ctx, organizationId: string): Promise<ListSegmentsResult> => {
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
  }
);

/**
 * Get a single segment by ID
 */
export const getSegment = orgAction(
  {
    name: "getSegment",
    resource: "segments",
    permission: ["read"],
    orgId: (_segmentId: string, organizationId: string) => organizationId,
    onError: "Failed to fetch segment",
  },
  async (
    ctx,
    segmentId: string,
    organizationId: string
  ): Promise<GetSegmentResult> => {
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
  }
);

/**
 * Create a new segment
 */
export const createSegment = orgAction(
  {
    name: "createSegment",
    resource: "segments",
    permission: ["write"],
    orgId: (
      organizationId: string,
      _data: {
        name: string;
        description?: string;
        condition: FilterCondition;
        trackMembership?: boolean;
      }
    ) => organizationId,
    onError: "Failed to create segment",
  },
  async (
    ctx,
    organizationId: string,
    data: {
      name: string;
      description?: string;
      condition: FilterCondition;
      trackMembership?: boolean;
    }
  ): Promise<CreateSegmentResult> => {
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
    const [newSegment] = await ctx.audited(
      async (tx) => {
        const [r] = await tx
          .insert(segment)
          .values({
            organizationId,
            name: data.name.trim(),
            description: data.description?.trim() || null,
            condition: data.condition,
            trackMembership: data.trackMembership ?? false,
            memberCount,
            lastComputedAt: new Date(),
            createdBy: ctx.access.userId,
          })
          .returning();
        return [r];
      },
      ([r]) => ({
        action: "segment.created" as const,
        resource: "segment",
        resourceId: r.id,
        metadata: { segmentId: r.id, name: r.name },
      })
    );

    if (!newSegment) {
      return { success: false, error: "Failed to create segment" };
    }

    // Revalidate
    revalidatePath(`/${ctx.access.orgSlug}/segments`, "page");

    // Return the created segment
    return await getSegment(newSegment.id, organizationId);
  }
);

/**
 * Update a segment
 */
export const updateSegment = orgAction(
  {
    name: "updateSegment",
    resource: "segments",
    permission: ["write"],
    orgId: (
      _segmentId: string,
      organizationId: string,
      _data: {
        name?: string;
        description?: string | null;
        condition?: FilterCondition;
        trackMembership?: boolean;
      }
    ) => organizationId,
    onError: "Failed to update segment",
  },
  async (
    ctx,
    segmentId: string,
    organizationId: string,
    data: {
      name?: string;
      description?: string | null;
      condition?: FilterCondition;
      trackMembership?: boolean;
    }
  ): Promise<UpdateSegmentResult> => {
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
    await ctx.audited(
      async (tx) => {
        await tx
          .update(segment)
          .set(updateData)
          .where(
            and(
              eq(segment.id, segmentId),
              eq(segment.organizationId, organizationId)
            )
          );
      },
      () => ({
        action: "segment.updated" as const,
        resource: "segment",
        resourceId: segmentId,
        metadata: { segmentId, name: updateData.name ?? existing.name },
      })
    );

    // Revalidate
    revalidatePath(`/${ctx.access.orgSlug}/segments`, "page");

    // Return updated segment
    return await getSegment(segmentId, organizationId);
  }
);

/**
 * Delete a segment
 */
export const deleteSegment = orgAction(
  {
    name: "deleteSegment",
    resource: "segments",
    permission: ["delete"],
    orgId: (_segmentId: string, organizationId: string) => organizationId,
    onError: "Failed to delete segment",
  },
  async (
    ctx,
    segmentId: string,
    organizationId: string
  ): Promise<DeleteSegmentResult> => {
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
    await ctx.audited(
      async (tx) => {
        await tx
          .delete(segment)
          .where(
            and(
              eq(segment.id, segmentId),
              eq(segment.organizationId, organizationId)
            )
          );
      },
      () => ({
        action: "segment.deleted" as const,
        resource: "segment",
        resourceId: segmentId,
        metadata: { segmentId },
      })
    );

    // Revalidate
    revalidatePath(`/${ctx.access.orgSlug}/segments`, "page");

    return { success: true };
  }
);

/**
 * Preview segment - count matching contacts and return sample emails
 */
export const previewSegment = orgAction(
  {
    name: "previewSegment",
    resource: "segments",
    permission: ["read"],
    orgId: (organizationId: string, _condition: FilterCondition) =>
      organizationId,
    onError: "Failed to preview segment",
  },
  async (
    ctx,
    organizationId: string,
    condition: FilterCondition
  ): Promise<PreviewSegmentResult> => {
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
  }
);

/**
 * Get unique property keys from contacts
 */
export type GetPropertyKeysResult =
  | { success: true; keys: string[] }
  | { success: false; error: string };

export const getPropertyKeys = orgAction(
  {
    name: "getPropertyKeys",
    resource: "segments",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to get property keys",
  },
  async (ctx, organizationId: string): Promise<GetPropertyKeysResult> => {
    const rows = await db.execute<{ key: string }>(
      sql`SELECT DISTINCT json_object_keys(${contact.properties}) AS key
          FROM ${contact}
          WHERE ${contact.organizationId} = ${organizationId}
            AND ${contact.properties} IS NOT NULL`
    );

    const keys = rows.rows.map((r) => r.key).sort();

    return { success: true, keys };
  }
);

/**
 * Recompute segment member counts (can be called periodically or on-demand)
 */
export const recomputeSegmentCounts = orgAction(
  {
    name: "recomputeSegmentCounts",
    resource: "segments",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to recompute segment counts",
  },
  async (
    ctx,
    organizationId: string
  ): Promise<{ success: boolean; error?: string }> => {
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
    revalidatePath(`/${ctx.access.orgSlug}/segments`, "page");

    return { success: true };
  }
);
