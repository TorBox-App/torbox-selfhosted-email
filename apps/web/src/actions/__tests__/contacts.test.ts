import {
  contact,
  contactTopic,
  db,
  member,
  organization,
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
  createContact,
  deleteContact,
  getContact,
  listContacts,
  subscribeContactToTopics,
  unsubscribeContactFromTopics,
  updateContact,
} from "../contacts";

// Test data
const testUser = {
  id: "test-contacts-user-1",
  email: "contacts-test@example.com",
  name: "Contacts Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-contacts-org-1",
  name: "Contacts Test Org",
  slug: "contacts-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-contacts-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testTopic = {
  id: "test-contacts-topic-1",
  organizationId: testOrganization.id,
  name: "Newsletter",
  slug: "newsletter",
  description: "Weekly newsletter",
  public: true,
  doubleOptIn: false,
  subscriberCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
};

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock the auth module
vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: testUser.id, email: testUser.email, name: testUser.name },
        session: {
          id: "session-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      })),
    },
  },
}));

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
    .values(testMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMember.role },
    });

  // Insert test topic
  await db
    .insert(topic)
    .values(testTopic)
    .onConflictDoUpdate({
      target: topic.id,
      set: { name: testTopic.name },
    });
});

// Clean up contacts before each test
beforeEach(async () => {
  await db.delete(contact).where(eq(contact.organizationId, testOrganization.id));
  // Reset topic subscriber count
  await db
    .update(topic)
    .set({ subscriberCount: 0 })
    .where(eq(topic.id, testTopic.id));
});

// Clean up after all tests
afterAll(async () => {
  await db.delete(contact).where(eq(contact.organizationId, testOrganization.id));
  await db.delete(topic).where(eq(topic.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.id, testMember.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

describe("Contacts Server Actions", () => {
  describe("createContact", () => {
    it("should create a new contact", async () => {
      const result = await createContact(testOrganization.id, {
        email: "new@example.com",
        status: "active",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.email).toBe("new@example.com");
        expect(result.contact.status).toBe("active");
      }
    });

    it("should create contact with custom properties", async () => {
      const result = await createContact(testOrganization.id, {
        email: "props@example.com",
        properties: {
          firstName: "John",
          lastName: "Doe",
          plan: "pro",
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.properties).toEqual({
          firstName: "John",
          lastName: "Doe",
          plan: "pro",
        });
      }
    });

    it("should subscribe contact to topics on creation", async () => {
      const result = await createContact(testOrganization.id, {
        email: "subscribed@example.com",
        topicIds: [testTopic.id],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.topics).toHaveLength(1);
        expect(result.contact.topics?.[0].topicId).toBe(testTopic.id);
        expect(result.contact.topics?.[0].status).toBe("subscribed");
      }

      // Verify topic subscriber count was incremented
      const updatedTopic = await db.query.topic.findFirst({
        where: eq(topic.id, testTopic.id),
      });
      expect(updatedTopic?.subscriberCount).toBe(1);
    });

    it("should reject duplicate email", async () => {
      await createContact(testOrganization.id, { email: "duplicate@example.com" });
      const result = await createContact(testOrganization.id, {
        email: "duplicate@example.com",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already exists");
      }
    });

    it("should reject invalid email", async () => {
      const result = await createContact(testOrganization.id, {
        email: "invalid-email",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid email");
      }
    });

    it("should normalize email to lowercase", async () => {
      const result = await createContact(testOrganization.id, {
        email: "UPPERCASE@EXAMPLE.COM",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.email).toBe("uppercase@example.com");
      }
    });
  });

  describe("listContacts", () => {
    beforeEach(async () => {
      // Create test contacts
      await createContact(testOrganization.id, {
        email: "alice@example.com",
        status: "active",
      });
      await createContact(testOrganization.id, {
        email: "bob@example.com",
        status: "active",
        topicIds: [testTopic.id],
      });
      await createContact(testOrganization.id, {
        email: "charlie@example.com",
        status: "unsubscribed",
      });
    });

    it("should list all contacts", async () => {
      const result = await listContacts(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contacts).toHaveLength(3);
        expect(result.total).toBe(3);
      }
    });

    it("should paginate results", async () => {
      const result = await listContacts(testOrganization.id, {
        page: 1,
        pageSize: 2,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contacts).toHaveLength(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(2);
      }
    });

    it("should filter by status", async () => {
      const result = await listContacts(testOrganization.id, {
        status: "unsubscribed",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].email).toBe("charlie@example.com");
      }
    });

    it("should filter by topic", async () => {
      const result = await listContacts(testOrganization.id, {
        topicId: testTopic.id,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].email).toBe("bob@example.com");
      }
    });

    it("should search by email", async () => {
      const result = await listContacts(testOrganization.id, {
        search: "alice",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].email).toBe("alice@example.com");
      }
    });
  });

  describe("getContact", () => {
    it("should get contact by ID", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "get@example.com",
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await getContact(createResult.contact.id, testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.email).toBe("get@example.com");
      }
    });

    it("should return error for non-existent contact", async () => {
      const result = await getContact("non-existent-id", testOrganization.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("updateContact", () => {
    it("should update contact email", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "old@example.com",
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await updateContact(
        createResult.contact.id,
        testOrganization.id,
        { email: "new@example.com" }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.email).toBe("new@example.com");
      }
    });

    it("should update contact status", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "status@example.com",
        status: "active",
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await updateContact(
        createResult.contact.id,
        testOrganization.id,
        { status: "unsubscribed" }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.status).toBe("unsubscribed");
        expect(result.contact.unsubscribedAt).not.toBeNull();
      }
    });

    it("should update contact properties", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "props-update@example.com",
        properties: { firstName: "John" },
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await updateContact(
        createResult.contact.id,
        testOrganization.id,
        { properties: { firstName: "Jane", lastName: "Doe" } }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.contact.properties).toEqual({
          firstName: "Jane",
          lastName: "Doe",
        });
      }
    });

    it("should reject duplicate email on update", async () => {
      await createContact(testOrganization.id, { email: "existing@example.com" });
      const createResult = await createContact(testOrganization.id, {
        email: "tochange@example.com",
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await updateContact(
        createResult.contact.id,
        testOrganization.id,
        { email: "existing@example.com" }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already exists");
      }
    });
  });

  describe("deleteContact", () => {
    it("should delete contact", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "delete@example.com",
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await deleteContact(createResult.contact.id, testOrganization.id);

      expect(result.success).toBe(true);

      // Verify contact is deleted
      const getResult = await getContact(createResult.contact.id, testOrganization.id);
      expect(getResult.success).toBe(false);
    });

    it("should decrement topic subscriber counts on delete", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "delete-sub@example.com",
        topicIds: [testTopic.id],
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      // Verify subscriber count is 1
      let topicData = await db.query.topic.findFirst({
        where: eq(topic.id, testTopic.id),
      });
      expect(topicData?.subscriberCount).toBe(1);

      // Delete contact
      await deleteContact(createResult.contact.id, testOrganization.id);

      // Verify subscriber count is 0
      topicData = await db.query.topic.findFirst({
        where: eq(topic.id, testTopic.id),
      });
      expect(topicData?.subscriberCount).toBe(0);
    });

    it("should return error for non-existent contact", async () => {
      const result = await deleteContact("non-existent-id", testOrganization.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("subscribeContactToTopics", () => {
    it("should subscribe contact to new topics", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "subscribe@example.com",
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await subscribeContactToTopics(
        createResult.contact.id,
        testOrganization.id,
        [testTopic.id]
      );

      expect(result.success).toBe(true);

      // Verify subscription
      const getResult = await getContact(createResult.contact.id, testOrganization.id);
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.contact.topics).toHaveLength(1);
        expect(getResult.contact.topics?.[0].status).toBe("subscribed");
      }
    });

    it("should resubscribe previously unsubscribed contact", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "resubscribe@example.com",
        topicIds: [testTopic.id],
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      // Unsubscribe
      await unsubscribeContactFromTopics(
        createResult.contact.id,
        testOrganization.id,
        [testTopic.id]
      );

      // Resubscribe
      const result = await subscribeContactToTopics(
        createResult.contact.id,
        testOrganization.id,
        [testTopic.id]
      );

      expect(result.success).toBe(true);

      // Verify resubscription
      const getResult = await getContact(createResult.contact.id, testOrganization.id);
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.contact.topics?.[0].status).toBe("subscribed");
      }
    });
  });

  describe("unsubscribeContactFromTopics", () => {
    it("should unsubscribe contact from topics", async () => {
      const createResult = await createContact(testOrganization.id, {
        email: "unsubscribe@example.com",
        topicIds: [testTopic.id],
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const result = await unsubscribeContactFromTopics(
        createResult.contact.id,
        testOrganization.id,
        [testTopic.id]
      );

      expect(result.success).toBe(true);

      // Verify topic subscriber count decremented
      const topicData = await db.query.topic.findFirst({
        where: eq(topic.id, testTopic.id),
      });
      expect(topicData?.subscriberCount).toBe(0);
    });
  });
});
