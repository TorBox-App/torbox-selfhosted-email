/**
 * Cross-org topic-subscription IDOR regression tests — web server actions
 *
 * Verifies that subscribeContactToTopics and bulkSubscribeContactsToTopics
 * silently drop foreign-org topic UUIDs and never write contact_topic rows
 * for them. Mirrors the import-contacts IDOR test pattern.
 */

import {
  contact,
  contactTopic,
  db,
  member,
  organization,
  subscription,
  topic,
  user,
} from "@wraps/db";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  bulkSubscribeContactsToTopics,
  subscribeContactToTopics,
} from "../contacts-topics";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const TEST_USER_ID = "topics-idor-user-1";
const TEST_USER_EMAIL = "topics-idor@example.com";

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: {
          id: TEST_USER_ID,
          email: TEST_USER_EMAIL,
          name: "IDOR Test User",
        },
        session: {
          id: "topics-idor-session",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: TEST_USER_ID,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "topics-idor-token",
        },
      })),
    },
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const testUser = {
  id: TEST_USER_ID,
  email: TEST_USER_EMAIL,
  name: "IDOR Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: "topics-idor-org-1",
  name: "Topics IDOR Org",
  slug: "topics-idor-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const foreignOrg = {
  id: "topics-idor-foreign-org-1",
  name: "Topics IDOR Foreign Org",
  slug: "topics-idor-foreign-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "topics-idor-member-1",
  organizationId: testOrg.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testSubscription = {
  id: "topics-idor-sub-1",
  plan: "starter",
  referenceId: testOrg.id,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ownTopic = {
  id: "topics-idor-own-topic-1",
  organizationId: testOrg.id,
  name: "Own Topic",
  slug: "topics-idor-own-topic",
  description: null,
  public: true,
  doubleOptIn: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
};

const foreignTopic = {
  id: "topics-idor-foreign-topic-1",
  organizationId: foreignOrg.id,
  name: "Foreign Topic",
  slug: "topics-idor-foreign-topic",
  description: null,
  public: true,
  doubleOptIn: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
};

const testContact = {
  id: "topics-idor-contact-1",
  organizationId: testOrg.id,
  email: "topics-idor-contact@example.com",
  emailHash: "topics-idor-contact-hash",
  emailStatus: "active" as const,
  properties: {},
};

// ─── DB Setup / Teardown ─────────────────────────────────────────────────────

beforeAll(async () => {
  await db
    .insert(user)
    .values(testUser)
    .onConflictDoUpdate({
      target: user.id,
      set: { updatedAt: new Date() },
    });
  await db
    .insert(organization)
    .values(testOrg)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: testOrg.name },
    });
  await db
    .insert(organization)
    .values(foreignOrg)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: foreignOrg.name },
    });
  await db
    .insert(member)
    .values(testMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMember.role },
    });
  await db.delete(subscription).where(eq(subscription.referenceId, testOrg.id));
  await db.insert(subscription).values(testSubscription);
  await db
    .insert(topic)
    .values(ownTopic)
    .onConflictDoUpdate({
      target: topic.id,
      set: { name: ownTopic.name },
    });
  await db
    .insert(topic)
    .values(foreignTopic)
    .onConflictDoUpdate({
      target: topic.id,
      set: { name: foreignTopic.name },
    });
  await db
    .insert(contact)
    .values(testContact)
    .onConflictDoUpdate({
      target: contact.id,
      set: { emailStatus: testContact.emailStatus },
    });
});

beforeEach(async () => {
  // Remove any contact_topic rows from prior tests
  await db
    .delete(contactTopic)
    .where(eq(contactTopic.contactId, testContact.id));
});

afterAll(async () => {
  await db
    .delete(contactTopic)
    .where(eq(contactTopic.contactId, testContact.id));
  await db.delete(contact).where(eq(contact.id, testContact.id));
  await db.delete(topic).where(eq(topic.id, ownTopic.id));
  await db.delete(topic).where(eq(topic.id, foreignTopic.id));
  await db.delete(member).where(eq(member.id, testMember.id));
  await db.delete(subscription).where(eq(subscription.referenceId, testOrg.id));
  await db.delete(organization).where(eq(organization.id, testOrg.id));
  await db.delete(organization).where(eq(organization.id, foreignOrg.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("subscribeContactToTopics — cross-org IDOR", () => {
  it("subscribes to own topic and silently drops the foreign topic", async () => {
    const result = await subscribeContactToTopics(testContact.id, testOrg.id, [
      ownTopic.id,
      foreignTopic.id,
    ]);

    expect(result.success).toBe(true);

    // Own-topic row must exist with subscribed status
    const ownSubs = await db
      .select()
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, testContact.id),
          eq(contactTopic.topicId, ownTopic.id)
        )
      );
    expect(ownSubs).toHaveLength(1);
    expect(ownSubs[0].status).toBe("subscribed");

    // Foreign-topic row must NOT exist
    const foreignSubs = await db
      .select()
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, testContact.id),
          eq(contactTopic.topicId, foreignTopic.id)
        )
      );
    expect(foreignSubs).toHaveLength(0);
  });
});

describe("bulkSubscribeContactsToTopics — cross-org IDOR", () => {
  it("subscribes contacts to own topic and silently drops the foreign topic", async () => {
    const result = await bulkSubscribeContactsToTopics(
      testOrg.id,
      [testContact.id],
      [ownTopic.id, foreignTopic.id]
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);

    // Own-topic row must exist
    const ownSubs = await db
      .select()
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, testContact.id),
          eq(contactTopic.topicId, ownTopic.id)
        )
      );
    expect(ownSubs).toHaveLength(1);
    expect(ownSubs[0].status).toBe("subscribed");

    // Foreign-topic row must NOT exist
    const foreignSubs = await db
      .select()
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, testContact.id),
          eq(contactTopic.topicId, foreignTopic.id)
        )
      );
    expect(foreignSubs).toHaveLength(0);
  });
});
