import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  type SQL,
  sql,
} from "drizzle-orm";
import { db } from "../index";
import { awsAccount } from "../schema/app";
import { batchSend, type Channel } from "../schema/batch";
import { contact, contactTopic } from "../schema/contacts";
import { template } from "../schema/templates";
import { buildConditionSQL } from "../segment-filter";

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | DrizzleTransaction;

export type BroadcastRecord = typeof batchSend.$inferSelect;
export type BroadcastInsert = typeof batchSend.$inferInsert;

export type BroadcastRecipientFilter = {
  audienceType?: "all" | "topic" | "segment";
  topicId?: string;
  segmentId?: string;
};

// ── AWS Account ──────────────────────────────────────────────────────────────

export async function findAwsAccountForOrg(
  awsAccountId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<{ id: string } | null> {
  const [result] = await dbClient
    .select({ id: awsAccount.id })
    .from(awsAccount)
    .where(
      and(
        eq(awsAccount.id, awsAccountId),
        eq(awsAccount.organizationId, organizationId)
      )
    )
    .limit(1);
  return result ?? null;
}

// ── Broadcast reads ──────────────────────────────────────────────────────────

export async function findBroadcast(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<BroadcastRecord | null> {
  const [result] = await dbClient
    .select()
    .from(batchSend)
    .where(
      and(eq(batchSend.id, id), eq(batchSend.organizationId, organizationId))
    )
    .limit(1);
  return result ?? null;
}

export async function findBroadcastStatus(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<{ id: string; status: BroadcastRecord["status"] } | null> {
  const result = await dbClient.query.batchSend.findFirst({
    where: and(
      eq(batchSend.id, id),
      eq(batchSend.organizationId, organizationId)
    ),
    columns: { id: true, status: true },
  });
  return result ?? null;
}

export async function findDraftBroadcast(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<BroadcastRecord | null> {
  const result = await dbClient.query.batchSend.findFirst({
    where: and(
      eq(batchSend.id, id),
      eq(batchSend.organizationId, organizationId),
      eq(batchSend.status, "draft")
    ),
  });
  return result ?? null;
}

export async function findBroadcastWithMeta(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
) {
  return dbClient.query.batchSend.findFirst({
    where: and(
      eq(batchSend.id, id),
      eq(batchSend.organizationId, organizationId)
    ),
    with: {
      createdByUser: { columns: { id: true, name: true, email: true } },
      awsAccount: { columns: { id: true, name: true, region: true } },
      emailTemplate: { columns: { id: true, name: true } },
    },
  });
}

export type BroadcastWithMeta = NonNullable<
  Awaited<ReturnType<typeof findBroadcastWithMeta>>
>;

export async function listBroadcasts(
  organizationId: string,
  options: {
    page?: number;
    pageSize?: number;
    status?: BroadcastRecord["status"];
    channel?: Channel;
  },
  dbClient: DbClient = db
): Promise<{ batches: BroadcastWithMeta[]; total: number }> {
  const { page = 1, pageSize = 20, status, channel } = options;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(batchSend.organizationId, organizationId)];
  if (status) conditions.push(eq(batchSend.status, status));
  if (channel) conditions.push(eq(batchSend.channel, channel));

  const [totalResult] = await dbClient
    .select({ count: sql<number>`count(*)::int` })
    .from(batchSend)
    .where(and(...conditions));

  const total = totalResult?.count ?? 0;

  const batches = await dbClient.query.batchSend.findMany({
    where: and(...conditions),
    with: {
      createdByUser: { columns: { id: true, name: true, email: true } },
      awsAccount: { columns: { id: true, name: true, region: true } },
      emailTemplate: { columns: { id: true, name: true } },
    },
    orderBy: [desc(batchSend.createdAt)],
    limit: pageSize,
    offset,
  });

  return { batches, total };
}

// ── Broadcast writes ─────────────────────────────────────────────────────────

export async function createBroadcast(
  data: BroadcastInsert,
  dbClient: DbClient = db
): Promise<BroadcastRecord> {
  const [result] = await dbClient.insert(batchSend).values(data).returning();
  return result;
}

export async function promoteBroadcast(
  id: string,
  organizationId: string,
  data: Partial<BroadcastInsert>,
  dbClient: DbClient = db
): Promise<BroadcastRecord | null> {
  const [result] = await dbClient
    .update(batchSend)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(batchSend.id, id),
        eq(batchSend.organizationId, organizationId),
        eq(batchSend.status, "draft")
      )
    )
    .returning();
  return result ?? null;
}

export async function cancelBroadcast(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<void> {
  await dbClient
    .update(batchSend)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(batchSend.id, id), eq(batchSend.organizationId, organizationId))
    );
}

export async function insertDraftBroadcast(
  data: BroadcastInsert,
  dbClient: DbClient = db
): Promise<BroadcastRecord | null> {
  const [result] = await dbClient.insert(batchSend).values(data).returning();
  return result ?? null;
}

export async function updateDraftBroadcast(
  id: string,
  organizationId: string,
  data: Partial<BroadcastInsert>,
  dbClient: DbClient = db
): Promise<void> {
  await dbClient
    .update(batchSend)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(batchSend.id, id),
        eq(batchSend.organizationId, organizationId),
        eq(batchSend.status, "draft")
      )
    );
}

export async function deleteDraftBroadcast(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<{ id: string }[]> {
  return dbClient
    .delete(batchSend)
    .where(
      and(
        eq(batchSend.id, id),
        eq(batchSend.organizationId, organizationId),
        eq(batchSend.status, "draft")
      )
    )
    .returning({ id: batchSend.id });
}

export async function duplicateBroadcast(
  source: BroadcastRecord,
  organizationId: string,
  createdBy: string,
  dbClient: DbClient = db
): Promise<BroadcastRecord | null> {
  const [result] = await dbClient
    .insert(batchSend)
    .values({
      organizationId,
      status: "draft",
      channel: source.channel,
      name: `${source.name ?? "Untitled broadcast"} (copy)`,
      subject: source.subject,
      previewText: source.previewText,
      from: source.from,
      fromName: source.fromName,
      replyTo: source.replyTo,
      emailTemplateId: source.emailTemplateId,
      htmlContent: source.htmlContent,
      textContent: source.textContent,
      variableMappings: source.variableMappings,
      body: source.body,
      senderId: source.senderId,
      audienceType: source.audienceType ?? "all",
      topicId: source.topicId,
      segmentId: source.segmentId,
      awsAccountId: source.awsAccountId,
      createdBy,
    })
    .returning();
  return result ?? null;
}

// ── Recipient counting ───────────────────────────────────────────────────────

async function buildRecipientConditions(
  organizationId: string,
  channel: Channel,
  filter?: BroadcastRecipientFilter,
  dbClient: DbClient = db
): Promise<SQL[]> {
  const conditions: SQL[] = [eq(contact.organizationId, organizationId)];

  if (channel === "email") {
    conditions.push(isNotNull(contact.email));
    conditions.push(
      sql`(${contact.emailStatus} = 'active' OR ${contact.emailStatus} IS NULL)`
    );
  } else {
    conditions.push(isNotNull(contact.phone));
    conditions.push(eq(contact.smsStatus, "opted_in" as never));
  }

  if (filter?.audienceType === "topic" && filter.topicId) {
    const topicSubquery = dbClient
      .select({ contactId: contactTopic.contactId })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, contact.id),
          eq(contactTopic.topicId, filter.topicId),
          eq(contactTopic.status, "subscribed")
        )
      );
    conditions.push(exists(topicSubquery));
  } else if (filter?.audienceType === "segment" && filter.segmentId) {
    const seg = await dbClient.query.segment.findFirst({
      where: (s, { and: a, eq: e }) =>
        a(e(s.id, filter.segmentId!), e(s.organizationId, organizationId)),
    });
    if (seg?.condition) {
      const segmentSQL = buildConditionSQL(seg.condition);
      if (segmentSQL) conditions.push(segmentSQL);
    }
  }

  return conditions;
}

export async function countBroadcastRecipients(
  organizationId: string,
  channel: Channel,
  filter?: BroadcastRecipientFilter,
  dbClient: DbClient = db
): Promise<number> {
  const conditions = await buildRecipientConditions(
    organizationId,
    channel,
    filter,
    dbClient
  );

  const [result] = await dbClient
    .select({ count: sql<number>`count(*)::int` })
    .from(contact)
    .where(and(...conditions));

  return result?.count ?? 0;
}

export type SampleRecipient = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
};

export async function getSampleBroadcastRecipients(
  organizationId: string,
  channel: Channel,
  filter?: BroadcastRecipientFilter,
  limit = 5,
  dbClient: DbClient = db
): Promise<{ contacts: SampleRecipient[]; totalCount: number }> {
  const conditions = await buildRecipientConditions(
    organizationId,
    channel,
    filter,
    dbClient
  );

  const whereClause = and(...conditions);

  const [[countResult], contacts] = await Promise.all([
    dbClient
      .select({ count: sql<number>`count(*)::int` })
      .from(contact)
      .where(whereClause),
    dbClient
      .select({
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
      })
      .from(contact)
      .where(whereClause)
      .orderBy(desc(contact.createdAt))
      .limit(limit),
  ]);

  return { contacts, totalCount: countResult?.count ?? 0 };
}

// ── Template queries ──────────────────────────────────────────────────────────

export async function findTemplateForValidation(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
) {
  return dbClient.query.template.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.id, id), e(t.organizationId, organizationId)),
    columns: {
      id: true,
      sesTemplateName: true,
      subject: true,
      updatedAt: true,
      publishedAt: true,
    },
  });
}

export async function findTemplateVariables(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
) {
  return dbClient.query.template.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.id, id), e(t.organizationId, organizationId)),
    columns: {
      content: true,
      emailType: true,
      sourceFormat: true,
      variables: true,
    },
  });
}

export async function findTemplateContent(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
) {
  return dbClient.query.template.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.id, id), e(t.organizationId, organizationId)),
    columns: {
      content: true,
      subject: true,
      compiledHtml: true,
      sourceFormat: true,
    },
  });
}

export async function listPublishedTemplates(
  organizationId: string,
  dbClient: DbClient = db
) {
  return dbClient.query.template.findMany({
    where: (t, { and: a, eq: e }) =>
      a(e(t.organizationId, organizationId), e(t.status, "PUBLISHED")),
    columns: {
      id: true,
      name: true,
      subject: true,
      previewText: true,
    },
    orderBy: [desc(template.updatedAt)],
  });
}

// ── Topic queries ─────────────────────────────────────────────────────────────

export type TopicWithSubscriberCount = {
  id: string;
  name: string;
  subscriberCount: number;
};

export async function listTopicsWithSubscriberCounts(
  organizationId: string,
  dbClient: DbClient = db
): Promise<TopicWithSubscriberCount[]> {
  const topics = await dbClient.query.topic.findMany({
    where: (t, { eq: e }) => e(t.organizationId, organizationId),
    columns: { id: true, name: true },
  });

  const topicIds = topics.map((t) => t.id);
  const subscriberCounts =
    topicIds.length > 0
      ? await dbClient
          .select({
            topicId: contactTopic.topicId,
            count: sql<number>`count(*)::int`,
          })
          .from(contactTopic)
          .where(
            and(
              eq(contactTopic.status, "subscribed"),
              inArray(contactTopic.topicId, topicIds)
            )
          )
          .groupBy(contactTopic.topicId)
      : [];

  const countMap = new Map(subscriberCounts.map((c) => [c.topicId, c.count]));

  return topics
    .map((t) => ({
      id: t.id,
      name: t.name,
      subscriberCount: countMap.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.subscriberCount - a.subscriberCount);
}

// ── Segment queries ────────────────────────────────────────────────────────────

export type SegmentSummary = {
  id: string;
  name: string;
  memberCount: number;
};

export async function listSegmentsForBroadcast(
  organizationId: string,
  dbClient: DbClient = db
): Promise<SegmentSummary[]> {
  const segments = await dbClient.query.segment.findMany({
    where: (s, { eq: e }) => e(s.organizationId, organizationId),
    columns: { id: true, name: true, memberCount: true },
    orderBy: (s, { desc: d }) => [d(s.memberCount)],
  });

  return segments.map((s) => ({
    id: s.id,
    name: s.name,
    memberCount: s.memberCount,
  }));
}
