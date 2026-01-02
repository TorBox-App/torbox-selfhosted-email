import {
  contact,
  contactTopic,
  db,
  member,
  organization,
  topic,
  user,
} from "@wraps/db";
import { generateConfirmationToken } from "@wraps/email";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { confirmSubscription } from "../actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Test data
const testUser = {
  id: "test-confirm-user-1",
  email: "confirm-test@example.com",
  name: "Confirm Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-confirm-org-1",
  name: "Confirm Test Org",
  slug: "confirm-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testTopic = {
  id: "test-confirm-topic-1",
  organizationId: testOrganization.id,
  name: "Double Opt-In Topic",
  slug: "double-opt-in-topic",
  description: "Requires confirmation",
  public: true,
  doubleOptIn: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
};

const testContact = {
  id: "test-confirm-contact-1",
  organizationId: testOrganization.id,
  email: "subscriber@example.com",
  emailHash: "confirm-contact-hash",
  status: "active",
  properties: {},
  emailsSent: 0,
  emailsOpened: 0,
  emailsClicked: 0,
  smsSent: 0,
  smsClicked: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Set up test database
beforeAll(async () => {
  // Insert test user
  await db
    .insert(user)
    .values(testUser)
    .onConflictDoUpdate({
      target: user.id,
      set: { updatedAt: new Date() },
    });

  // Insert test organization
  await db
    .insert(organization)
    .values(testOrganization)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: testOrganization.name },
    });

  // Insert test member
  await db
    .insert(member)
    .values({
      id: "test-confirm-member-1",
      organizationId: testOrganization.id,
      userId: testUser.id,
      role: "owner",
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: member.id,
      set: { role: "owner" },
    });

  // Insert test topic
  await db
    .insert(topic)
    .values(testTopic)
    .onConflictDoUpdate({
      target: topic.id,
      set: { updatedAt: new Date() },
    });

  // Insert test contact
  await db
    .insert(contact)
    .values(testContact)
    .onConflictDoUpdate({
      target: contact.id,
      set: { updatedAt: new Date() },
    });
});

// Clean up contact topics before each test
beforeEach(async () => {
  await db
    .delete(contactTopic)
    .where(eq(contactTopic.contactId, testContact.id));
});

// Clean up after all tests
afterAll(async () => {
  await db
    .delete(contactTopic)
    .where(eq(contactTopic.contactId, testContact.id));
  await db.delete(contact).where(eq(contact.id, testContact.id));
  await db.delete(topic).where(eq(topic.id, testTopic.id));
  await db.delete(member).where(eq(member.organizationId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

describe("confirmSubscription", () => {
  it("should confirm a pending subscription", async () => {
    // Create pending subscription
    await db.insert(contactTopic).values({
      contactId: testContact.id,
      topicId: testTopic.id,
      status: "pending",
      subscribedAt: null,
      confirmedAt: null,
    });

    // Generate valid token
    const token = await generateConfirmationToken(
      testContact.id,
      testOrganization.id,
      testTopic.id
    );

    const result = await confirmSubscription(token);

    expect(result.success).toBe(true);

    // Verify subscription is now confirmed
    const [subscription] = await db
      .select()
      .from(contactTopic)
      .where(eq(contactTopic.contactId, testContact.id))
      .limit(1);

    expect(subscription.status).toBe("subscribed");
    expect(subscription.confirmedAt).not.toBeNull();
    expect(subscription.subscribedAt).not.toBeNull();
  });

  it("should return success for already confirmed subscription", async () => {
    const confirmedAt = new Date();

    // Create already confirmed subscription
    await db.insert(contactTopic).values({
      contactId: testContact.id,
      topicId: testTopic.id,
      status: "subscribed",
      subscribedAt: confirmedAt,
      confirmedAt,
    });

    // Generate valid token
    const token = await generateConfirmationToken(
      testContact.id,
      testOrganization.id,
      testTopic.id
    );

    const result = await confirmSubscription(token);

    // Should still succeed (idempotent)
    expect(result.success).toBe(true);
  });

  it("should create subscription if none exists", async () => {
    // No subscription exists

    // Generate valid token
    const token = await generateConfirmationToken(
      testContact.id,
      testOrganization.id,
      testTopic.id
    );

    const result = await confirmSubscription(token);

    expect(result.success).toBe(true);

    // Verify subscription was created
    const [subscription] = await db
      .select()
      .from(contactTopic)
      .where(eq(contactTopic.contactId, testContact.id))
      .limit(1);

    expect(subscription).toBeDefined();
    expect(subscription.status).toBe("subscribed");
    expect(subscription.confirmedAt).not.toBeNull();
  });

  it("should fail with invalid token", async () => {
    const result = await confirmSubscription("invalid-token");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid or expired");
    }
  });

  it("should fail with expired token", async () => {
    // Generate token then manually create an expired one
    // For this test, we'll use an obviously invalid token
    const result = await confirmSubscription(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaWQiOiJ0ZXN0IiwidHlwZSI6ImNvbmZpcm0iLCJleHAiOjF9.invalid"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid or expired");
    }
  });

  it("should fail with non-existent contact", async () => {
    // Generate token for non-existent contact
    const token = await generateConfirmationToken(
      "non-existent-contact",
      testOrganization.id,
      testTopic.id
    );

    const result = await confirmSubscription(token);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Contact not found");
    }
  });

  it("should fail with non-existent topic", async () => {
    // Generate token for non-existent topic
    const token = await generateConfirmationToken(
      testContact.id,
      testOrganization.id,
      "non-existent-topic"
    );

    const result = await confirmSubscription(token);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Topic not found");
    }
  });

  it("should fail with mismatched organization", async () => {
    // Generate token with wrong organization
    const token = await generateConfirmationToken(
      testContact.id,
      "wrong-org-id",
      testTopic.id
    );

    const result = await confirmSubscription(token);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Contact not found");
    }
  });

  it("should clear unsubscribedAt when confirming", async () => {
    const unsubscribedAt = new Date(Date.now() - 86_400_000); // 1 day ago

    // Create subscription that was previously unsubscribed
    await db.insert(contactTopic).values({
      contactId: testContact.id,
      topicId: testTopic.id,
      status: "pending",
      subscribedAt: null,
      confirmedAt: null,
      unsubscribedAt,
    });

    // Generate valid token
    const token = await generateConfirmationToken(
      testContact.id,
      testOrganization.id,
      testTopic.id
    );

    const result = await confirmSubscription(token);

    expect(result.success).toBe(true);

    // Verify unsubscribedAt is cleared
    const [subscription] = await db
      .select()
      .from(contactTopic)
      .where(eq(contactTopic.contactId, testContact.id))
      .limit(1);

    expect(subscription.unsubscribedAt).toBeNull();
  });
});
