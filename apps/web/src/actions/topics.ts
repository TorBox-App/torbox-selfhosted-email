"use server";

import { contactTopic, db, topic } from "@wraps/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkFeatureAccess } from "@/lib/plan-limits";
import {
  type CreateTopicResult,
  type DeleteTopicResult,
  type GetTopicResult,
  generateSlug,
  type ListTopicsResult,
  type UpdateTopicResult,
} from "@/lib/topics";
import { orgAction } from "./shared/org-action";

// Re-export types for convenience
export type {
  CreateTopicResult,
  DeleteTopicResult,
  GetTopicResult,
  ListTopicsResult,
  TopicWithMeta,
  UpdateTopicResult,
} from "@/lib/topics";

type CreateTopicData = {
  name: string;
  slug?: string;
  description?: string;
  public?: boolean;
  doubleOptIn?: boolean;
};

type UpdateTopicData = {
  name?: string;
  slug?: string;
  description?: string | null;
  public?: boolean;
  doubleOptIn?: boolean;
};

/**
 * List all topics for an organization
 */
export const listTopics = orgAction(
  {
    name: "listTopics",
    resource: "topics",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to fetch topics",
  },
  async (ctx, organizationId: string): Promise<ListTopicsResult> => {
    const topics = await db.query.topic.findMany({
      where: (t, { eq }) => eq(t.organizationId, organizationId),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [desc(topic.createdAt)],
    });

    // Get subscriber counts scoped to this org's topics
    const topicIds = topics.map((t) => t.id);
    const subscriberCounts =
      topicIds.length > 0
        ? await db
            .select({
              topicId: contactTopic.topicId,
              count: sql<number>`count(*)::int`,
            })
            .from(contactTopic)
            .where(
              and(
                inArray(contactTopic.topicId, topicIds),
                eq(contactTopic.status, "subscribed")
              )
            )
            .groupBy(contactTopic.topicId)
        : [];

    const countMap = new Map(subscriberCounts.map((c) => [c.topicId, c.count]));

    return {
      success: true,
      topics: topics.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        public: t.public,
        doubleOptIn: t.doubleOptIn,
        subscriberCount: countMap.get(t.id) ?? 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        createdBy: t.createdByUser,
      })),
    };
  }
);

/**
 * Get a single topic by ID
 */
export const getTopic = orgAction(
  {
    name: "getTopic",
    resource: "topics",
    permission: ["read"],
    orgId: (_topicId: string, organizationId: string) => organizationId,
    onError: "Failed to fetch topic",
  },
  async (
    ctx,
    topicId: string,
    _organizationId: string
  ): Promise<GetTopicResult> => {
    const t = await db.query.topic.findFirst({
      where: (topic, { and, eq }) =>
        and(
          eq(topic.id, topicId),
          eq(topic.organizationId, ctx.organizationId)
        ),
      with: {
        createdByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!t) {
      return { success: false, error: "Topic not found" };
    }

    // Get subscriber count using SQL COUNT
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.topicId, topicId),
          eq(contactTopic.status, "subscribed")
        )
      );

    return {
      success: true,
      topic: {
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        public: t.public,
        doubleOptIn: t.doubleOptIn,
        subscriberCount: countResult?.count ?? 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        createdBy: t.createdByUser,
      },
    };
  }
);

/**
 * Create a new topic
 */
export const createTopic = orgAction(
  {
    name: "createTopic",
    resource: "topics",
    permission: ["write"],
    orgId: (organizationId: string, _data: CreateTopicData) => organizationId,
    onError: "Failed to create topic",
  },
  async (
    ctx,
    organizationId: string,
    data: CreateTopicData
  ): Promise<CreateTopicResult> => {
    // Check if topics feature is available for this plan (Starter+)
    const featureCheck = await checkFeatureAccess(organizationId, "topics");
    if (!featureCheck.allowed) {
      return {
        success: false,
        error: featureCheck.message ?? "Topics require a paid plan.",
      };
    }

    // Validate name
    if (!data.name || data.name.trim().length < 1) {
      return { success: false, error: "Topic name is required" };
    }

    // Generate or validate slug
    const slug = data.slug
      ? data.slug.toLowerCase().trim()
      : generateSlug(data.name);

    if (!slug || slug.length < 1) {
      return { success: false, error: "Invalid topic slug" };
    }

    // Check for duplicate slug
    const existing = await db.query.topic.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.organizationId, organizationId), eq(t.slug, slug)),
    });

    if (existing) {
      return { success: false, error: "A topic with this slug already exists" };
    }

    // Create topic
    const newTopic = await ctx.audited(
      async (tx) => {
        const [r] = await tx
          .insert(topic)
          .values({
            organizationId,
            name: data.name.trim(),
            slug,
            description: data.description?.trim() || null,
            public: data.public ?? true,
            doubleOptIn: data.doubleOptIn ?? false,
            createdBy: ctx.access.userId,
          })
          .returning();
        return r;
      },
      (r) => ({
        action: "topic.created" as const,
        resource: "topic",
        resourceId: r.id,
        metadata: { topicId: r.id, name: r.name, slug: r.slug },
      })
    );

    if (!newTopic) {
      return { success: false, error: "Failed to create topic" };
    }

    // Revalidate
    revalidatePath(`/${ctx.access.orgSlug}/topics`, "page");

    // Return the created topic
    return await getTopic(newTopic.id, organizationId);
  }
);

/**
 * Update a topic
 */
export const updateTopic = orgAction(
  {
    name: "updateTopic",
    resource: "topics",
    permission: ["write"],
    orgId: (_topicId: string, organizationId: string, _data: UpdateTopicData) =>
      organizationId,
    onError: "Failed to update topic",
  },
  async (
    ctx,
    topicId: string,
    organizationId: string,
    data: UpdateTopicData
  ): Promise<UpdateTopicResult> => {
    // Verify topic exists
    const existing = await db.query.topic.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, topicId), eq(t.organizationId, organizationId)),
    });

    if (!existing) {
      return { success: false, error: "Topic not found" };
    }

    // Build update data
    const updateData: Partial<typeof topic.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < 1) {
        return { success: false, error: "Topic name is required" };
      }
      updateData.name = data.name.trim();
    }

    if (data.slug !== undefined) {
      const slug = data.slug.toLowerCase().trim();
      if (!slug || slug.length < 1) {
        return { success: false, error: "Invalid topic slug" };
      }

      // Check for duplicate slug (excluding current topic)
      const duplicate = await db.query.topic.findFirst({
        where: (t, { and, eq, ne }) =>
          and(
            eq(t.organizationId, organizationId),
            eq(t.slug, slug),
            ne(t.id, topicId)
          ),
      });

      if (duplicate) {
        return {
          success: false,
          error: "A topic with this slug already exists",
        };
      }

      updateData.slug = slug;
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.public !== undefined) {
      updateData.public = data.public;
    }

    if (data.doubleOptIn !== undefined) {
      updateData.doubleOptIn = data.doubleOptIn;
    }

    // Update topic
    await ctx.audited(
      async (tx) => {
        await tx
          .update(topic)
          .set(updateData)
          .where(
            and(eq(topic.id, topicId), eq(topic.organizationId, organizationId))
          );
      },
      () => ({
        action: "topic.updated" as const,
        resource: "topic",
        resourceId: topicId,
        metadata: { topicId, name: updateData.name ?? existing.name },
      })
    );

    // Revalidate
    revalidatePath(`/${ctx.access.orgSlug}/topics`, "page");

    // Return updated topic
    return await getTopic(topicId, organizationId);
  }
);

/**
 * Delete a topic
 */
export const deleteTopic = orgAction(
  {
    name: "deleteTopic",
    resource: "topics",
    permission: ["delete"],
    orgId: (_topicId: string, organizationId: string) => organizationId,
    onError: "Failed to delete topic",
  },
  async (
    ctx,
    topicId: string,
    organizationId: string
  ): Promise<DeleteTopicResult> => {
    // Verify topic exists
    const existing = await db.query.topic.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, topicId), eq(t.organizationId, organizationId)),
    });

    if (!existing) {
      return { success: false, error: "Topic not found" };
    }

    // Delete topic (cascades to contact_topic)
    await ctx.audited(
      async (tx) => {
        await tx
          .delete(topic)
          .where(
            and(eq(topic.id, topicId), eq(topic.organizationId, organizationId))
          );
      },
      () => ({
        action: "topic.deleted" as const,
        resource: "topic",
        resourceId: topicId,
        metadata: { topicId },
      })
    );

    // Revalidate
    revalidatePath(`/${ctx.access.orgSlug}/topics`, "page");

    return { success: true };
  }
);

/**
 * Get topic subscribers (paginated)
 */
export const getTopicSubscribers = orgAction(
  {
    name: "getTopicSubscribers",
    resource: "topics",
    permission: ["read"],
    orgId: (
      _topicId: string,
      organizationId: string,
      _options?: {
        page?: number;
        pageSize?: number;
        status?: "subscribed" | "unsubscribed";
      }
    ) => organizationId,
    onError: "Failed to fetch subscribers",
  },
  async (
    ctx,
    topicId: string,
    organizationId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: "subscribed" | "unsubscribed";
    } = {}
  ): Promise<{
    success: boolean;
    subscribers?: Array<{
      contactId: string;
      email: string;
      status: string;
      subscribedAt: Date | null;
      unsubscribedAt: Date | null;
    }>;
    total?: number;
    page?: number;
    pageSize?: number;
    error?: string;
  }> => {
    const { page = 1, pageSize = 50, status } = options;
    const offset = (page - 1) * pageSize;

    // Verify topic exists and belongs to org
    const topicExists = await db.query.topic.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, topicId), eq(t.organizationId, organizationId)),
    });

    if (!topicExists) {
      return { success: false, error: "Topic not found" };
    }

    // Build where conditions
    const conditions = [eq(contactTopic.topicId, topicId)];
    if (status) {
      conditions.push(eq(contactTopic.status, status));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactTopic)
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    // Get subscribers with contact info
    const subscribers = await db.query.contactTopic.findMany({
      where: and(...conditions),
      with: {
        contact: {
          columns: {
            id: true,
            email: true,
          },
        },
      },
      limit: pageSize,
      offset,
    });

    return {
      success: true,
      subscribers: subscribers.map((s) => ({
        contactId: s.contact.id,
        email: s.contact.email || "",
        status: s.status,
        subscribedAt: s.subscribedAt,
        unsubscribedAt: s.unsubscribedAt,
      })),
      total,
      page,
      pageSize,
    };
  }
);
