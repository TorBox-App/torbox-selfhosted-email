import { createHash } from "node:crypto";
import { and, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { db, eq, escapeIlike } from "../index";
import { contact, contactTopic, topic } from "../schema/contacts";

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | DrizzleTransaction;

export type ContactRecord = typeof contact.$inferSelect;
export type ContactTopicRecord = {
  topicId: string;
  topicName: string;
  status: string;
  subscribedAt: Date | null;
};
export type TopicSubscriptionInfo = {
  id: string;
  name: string;
  description: string | null;
  doubleOptIn: boolean;
};
export type ExistingSubscription = {
  topicId: string;
  status: string;
  confirmedAt: Date | null;
};
export type ContactListFilters = {
  emailStatus?: string;
  smsStatus?: string;
  preferredChannel?: string;
  search?: string;
};
export type ContactListResult = {
  contacts: ContactRecord[];
  total: number;
};
export type ContactTopicInsert = {
  contactId: string;
  topicId: string;
  status: string;
  subscribedAt: Date | null;
  confirmedAt: Date | null;
};

export function hashContactValue(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function detectContactIdType(
  id: string
): "uuid" | "email" | "externalId" {
  if (id.includes("@")) return "email";
  if (UUID_RE.test(id)) return "uuid";
  return "externalId";
}

export async function listContacts(
  organizationId: string,
  filters: ContactListFilters,
  pagination: { page: number; pageSize: number },
  dbClient: DbClient = db
): Promise<ContactListResult> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(contact.organizationId, organizationId)];

  if (filters.emailStatus) {
    conditions.push(eq(contact.emailStatus, filters.emailStatus as never));
  }
  if (filters.smsStatus) {
    conditions.push(eq(contact.smsStatus, filters.smsStatus as never));
  }
  if (filters.preferredChannel) {
    conditions.push(
      eq(contact.preferredChannel, filters.preferredChannel as never)
    );
  }
  if (filters.search) {
    const search = `%${escapeIlike(filters.search)}%`;
    conditions.push(
      or(
        sql`${contact.email} ILIKE ${search}`,
        sql`${contact.phone} ILIKE ${search}`
      )!
    );
  }

  const [countResult] = await dbClient
    .select({ count: sql<number>`count(*)::int` })
    .from(contact)
    .where(and(...conditions));

  const total = countResult?.count ?? 0;

  const contacts = await dbClient
    .select()
    .from(contact)
    .where(and(...conditions))
    .orderBy(desc(contact.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { contacts, total };
}

export async function findContact(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<(ContactRecord & { topics: ContactTopicRecord[] }) | null> {
  const idType = detectContactIdType(id);
  const idCondition =
    idType === "email"
      ? eq(contact.email, id)
      : idType === "uuid"
        ? eq(contact.id, id)
        : eq(contact.externalId, id);

  const [result] = await dbClient
    .select()
    .from(contact)
    .where(and(idCondition, eq(contact.organizationId, organizationId)))
    .limit(1);

  if (!result) return null;

  const topics = await dbClient
    .select({
      topicId: contactTopic.topicId,
      topicName: topic.name,
      status: contactTopic.status,
      subscribedAt: contactTopic.subscribedAt,
    })
    .from(contactTopic)
    .innerJoin(topic, eq(topic.id, contactTopic.topicId))
    .where(eq(contactTopic.contactId, result.id));

  return { ...result, topics };
}

export async function resolveContactId(
  id: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<string | null> {
  const idType = detectContactIdType(id);
  const idCondition =
    idType === "email"
      ? eq(contact.email, id)
      : idType === "uuid"
        ? eq(contact.id, id)
        : eq(contact.externalId, id);

  const [result] = await dbClient
    .select({ id: contact.id })
    .from(contact)
    .where(and(idCondition, eq(contact.organizationId, organizationId)))
    .limit(1);

  return result?.id ?? null;
}

export async function findContactByExternalId(
  externalId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<{ id: string } | null> {
  const [result] = await dbClient
    .select({ id: contact.id })
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        eq(contact.externalId, externalId)
      )
    )
    .limit(1);
  return result ?? null;
}

export async function findContactByEmailHash(
  emailHash: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<{ id: string } | null> {
  const [result] = await dbClient
    .select({ id: contact.id })
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        eq(contact.emailHash, emailHash)
      )
    )
    .limit(1);
  return result ?? null;
}

export async function findContactByPhoneHash(
  phoneHash: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<{ id: string } | null> {
  const [result] = await dbClient
    .select({ id: contact.id })
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        eq(contact.phoneHash, phoneHash)
      )
    )
    .limit(1);
  return result ?? null;
}

export type InsertContactData = typeof contact.$inferInsert;

export async function insertContact(
  data: InsertContactData,
  dbClient: DbClient = db
): Promise<ContactRecord | null> {
  const [result] = await dbClient
    .insert(contact)
    .values(data)
    .onConflictDoNothing()
    .returning();
  return result ?? null;
}

export async function resolveTopicSlugs(
  slugs: string[],
  organizationId: string,
  dbClient: DbClient = db
): Promise<string[]> {
  if (slugs.length === 0) return [];

  const topics = await dbClient
    .select({ id: topic.id })
    .from(topic)
    .where(
      and(eq(topic.organizationId, organizationId), inArray(topic.slug, slugs))
    );

  return topics.map((t) => t.id);
}

export async function fetchTopicsForSubscription(
  topicIds: string[],
  organizationId: string,
  dbClient: DbClient = db
): Promise<TopicSubscriptionInfo[]> {
  if (topicIds.length === 0) return [];

  return dbClient
    .select({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      doubleOptIn: topic.doubleOptIn,
    })
    .from(topic)
    .where(
      and(eq(topic.organizationId, organizationId), inArray(topic.id, topicIds))
    );
}

export async function insertContactTopics(
  values: ContactTopicInsert[],
  dbClient: DbClient = db
): Promise<void> {
  if (values.length === 0) return;
  await dbClient.insert(contactTopic).values(values);
}

export async function fetchContactSubscriptions(
  contactId: string,
  dbClient: DbClient = db
): Promise<ExistingSubscription[]> {
  return dbClient
    .select({
      topicId: contactTopic.topicId,
      status: contactTopic.status,
      confirmedAt: contactTopic.confirmedAt,
    })
    .from(contactTopic)
    .where(eq(contactTopic.contactId, contactId));
}

export async function reactivateContactSubscriptions(
  contactId: string,
  topicIds: string[],
  now: Date,
  dbClient: DbClient = db
): Promise<void> {
  if (topicIds.length === 0) return;
  await dbClient
    .update(contactTopic)
    .set({ status: "subscribed", subscribedAt: now })
    .where(
      and(
        eq(contactTopic.contactId, contactId),
        inArray(contactTopic.topicId, topicIds)
      )
    );
}

export async function setPendingContactSubscriptions(
  contactId: string,
  topicIds: string[],
  dbClient: DbClient = db
): Promise<void> {
  if (topicIds.length === 0) return;
  await dbClient
    .update(contactTopic)
    .set({ status: "pending", subscribedAt: null })
    .where(
      and(
        eq(contactTopic.contactId, contactId),
        inArray(contactTopic.topicId, topicIds)
      )
    );
}

export async function fetchTopicNamesByIds(
  topicIds: string[],
  organizationId: string,
  dbClient: DbClient = db
): Promise<Map<string, string>> {
  if (topicIds.length === 0) return new Map();
  const rows = await dbClient
    .select({ id: topic.id, name: topic.name })
    .from(topic)
    .where(
      and(eq(topic.organizationId, organizationId), inArray(topic.id, topicIds))
    );
  return new Map(rows.map((t) => [t.id, t.name]));
}

export async function updateContactFields(
  contactId: string,
  organizationId: string,
  updateValues: Partial<typeof contact.$inferInsert> & Record<string, unknown>,
  dbClient: DbClient = db
): Promise<ContactRecord> {
  const [updated] = await dbClient
    .update(contact)
    .set(updateValues as never)
    .where(
      and(eq(contact.id, contactId), eq(contact.organizationId, organizationId))
    )
    .returning();
  // Callers ensure contact exists before calling this (via resolveContactId)
  return updated as ContactRecord;
}

export async function deleteContact(
  resolvedId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<void> {
  await dbClient
    .delete(contact)
    .where(
      and(
        eq(contact.id, resolvedId),
        eq(contact.organizationId, organizationId)
      )
    );
}

export async function bulkDeleteContacts(
  ids: string[],
  organizationId: string,
  dbClient: DbClient = db
): Promise<number> {
  const result = await dbClient
    .delete(contact)
    .where(
      and(eq(contact.organizationId, organizationId), inArray(contact.id, ids))
    )
    .returning({ id: contact.id });
  return result.length;
}

export async function findContactById(
  contactId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<ContactRecord | null> {
  const [result] = await dbClient
    .select()
    .from(contact)
    .where(
      and(eq(contact.id, contactId), eq(contact.organizationId, organizationId))
    )
    .limit(1);
  return result ?? null;
}

export async function findContactsByEmailHashes(
  organizationId: string,
  emailHashes: string[],
  dbClient: DbClient = db
): Promise<{ id: string; email: string | null }[]> {
  if (emailHashes.length === 0) return [];
  return dbClient
    .select({ id: contact.id, email: contact.email })
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        inArray(contact.emailHash, emailHashes)
      )
    );
}

export async function subscribeContactToTopicsOnCreate(
  contactId: string,
  topicIds: string[],
  dbClient: DbClient = db
): Promise<void> {
  if (topicIds.length === 0) return;
  await dbClient
    .insert(contactTopic)
    .values(
      topicIds.map((topicId) => ({ contactId, topicId, status: "subscribed" }))
    );
}

export type ContactWebFilters = {
  emailStatus?: string;
  status?: string;
  search?: string;
};

export async function listContactsWithRelations(
  organizationId: string,
  filters: ContactWebFilters,
  pagination: { page: number; pageSize: number },
  topicId?: string
) {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(contact.organizationId, organizationId)];

  if (filters.search) {
    conditions.push(ilike(contact.email, `%${escapeIlike(filters.search)}%`));
  }

  if (filters.emailStatus) {
    conditions.push(eq(contact.emailStatus, filters.emailStatus as never));
  } else if (filters.status) {
    conditions.push(eq(contact.status, filters.status));
  }

  let where;
  if (topicId) {
    const subquery = db
      .select({ contactId: contactTopic.contactId })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.topicId, topicId),
          eq(contactTopic.status, "subscribed")
        )
      );
    where = and(...conditions, sql`${contact.id} IN (${subquery})`);
  } else {
    where = and(...conditions);
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contact)
    .where(where);

  const total = countResult?.count ?? 0;

  const contacts = await db.query.contact.findMany({
    where,
    with: {
      createdByUser: {
        columns: { id: true, name: true, email: true },
      },
      topics: {
        with: {
          topic: {
            columns: { id: true, name: true },
          },
        },
      },
    },
    orderBy: [desc(contact.createdAt)],
    limit: pageSize,
    offset,
  });

  return { contacts, total };
}

export async function findContactWithRelations(
  contactId: string,
  organizationId: string
) {
  return db.query.contact.findFirst({
    where: (c, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(c.id, contactId), eqOp(c.organizationId, organizationId)),
    with: {
      createdByUser: {
        columns: { id: true, name: true, email: true },
      },
      topics: {
        with: {
          topic: {
            columns: { id: true, name: true },
          },
        },
      },
    },
  });
}
