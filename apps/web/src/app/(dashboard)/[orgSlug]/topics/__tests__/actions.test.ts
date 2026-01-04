import {
  contact,
  db,
  member,
  organization,
  topicSettings,
  user,
} from "@wraps/db";
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
import {
  generatePreferenceCenterPreviewUrl,
  getTopicSettings,
  updateTopicSettings,
} from "../actions";

// Test data
const testUser = {
  id: "test-topic-settings-user-1",
  email: "topic-settings-test@example.com",
  name: "Topic Settings Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testMemberUser = {
  id: "test-topic-settings-member-1",
  email: "topic-settings-member@example.com",
  name: "Topic Settings Member User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-topic-settings-org-1",
  name: "Topic Settings Test Org",
  slug: "topic-settings-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testOwnerMember = {
  id: "test-topic-settings-owner-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testRegularMember = {
  id: "test-topic-settings-regular-1",
  organizationId: testOrganization.id,
  userId: testMemberUser.id,
  role: "member" as const,
  createdAt: new Date(),
};

// Track current mock user
let currentMockUserId = testUser.id;

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
        user: {
          id: currentMockUserId,
          email:
            currentMockUserId === testUser.id
              ? testUser.email
              : testMemberUser.email,
          name:
            currentMockUserId === testUser.id
              ? testUser.name
              : testMemberUser.name,
        },
        session: {
          id: "session-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: currentMockUserId,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      })),
    },
  },
}));

// Set up test database
beforeAll(async () => {
  // Insert test users
  await db
    .insert(user)
    .values(testUser)
    .onConflictDoUpdate({
      target: user.id,
      set: { updatedAt: new Date() },
    });

  await db
    .insert(user)
    .values(testMemberUser)
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

  // Insert test members
  await db
    .insert(member)
    .values(testOwnerMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testOwnerMember.role },
    });

  await db
    .insert(member)
    .values(testRegularMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testRegularMember.role },
    });
});

// Clean up settings before each test and reset mock user
beforeEach(async () => {
  currentMockUserId = testUser.id; // Reset to owner
  await db
    .delete(topicSettings)
    .where(eq(topicSettings.organizationId, testOrganization.id));
  await db
    .delete(contact)
    .where(eq(contact.organizationId, testOrganization.id));
});

// Clean up after all tests
afterAll(async () => {
  await db
    .delete(topicSettings)
    .where(eq(topicSettings.organizationId, testOrganization.id));
  await db
    .delete(contact)
    .where(eq(contact.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.id, testOwnerMember.id));
  await db.delete(member).where(eq(member.id, testRegularMember.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
  await db.delete(user).where(eq(user.id, testMemberUser.id));
});

describe("Topic Settings Server Actions", () => {
  describe("getTopicSettings", () => {
    it("should return null when no settings exist", async () => {
      const result = await getTopicSettings(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.settings).toBeNull();
      }
    });

    it("should return existing settings", async () => {
      // Create settings first
      await db.insert(topicSettings).values({
        organizationId: testOrganization.id,
        confirmationFromName: "Test Company",
        confirmationFromEmail: "test@example.com",
      });

      const result = await getTopicSettings(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.settings).not.toBeNull();
        expect(result.settings?.confirmationFromName).toBe("Test Company");
        expect(result.settings?.confirmationFromEmail).toBe("test@example.com");
      }
    });

    it("should allow regular members to view settings", async () => {
      currentMockUserId = testMemberUser.id;

      const result = await getTopicSettings(testOrganization.id);

      expect(result.success).toBe(true);
    });

    it("should reject unauthorized users", async () => {
      // Mock a user with no membership
      vi.mocked(
        (await import("@wraps/auth")).auth.api.getSession
      ).mockResolvedValueOnce({
        user: {
          id: "unauthorized-user",
          email: "unauthorized@example.com",
          name: "Unauthorized",
        },
        session: {
          id: "session-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "unauthorized-user",
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      } as never);

      const result = await getTopicSettings(testOrganization.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("access");
      }
    });
  });

  describe("updateTopicSettings", () => {
    it("should create new settings when none exist", async () => {
      const result = await updateTopicSettings(testOrganization.id, {
        confirmationFromName: "New Company",
        confirmationFromEmail: "new@example.com",
        confirmationReplyToEmail: "reply@example.com",
      });

      expect(result.success).toBe(true);

      // Verify settings were created
      const getResult = await getTopicSettings(testOrganization.id);
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.settings?.confirmationFromName).toBe("New Company");
        expect(getResult.settings?.confirmationFromEmail).toBe(
          "new@example.com"
        );
        expect(getResult.settings?.confirmationReplyToEmail).toBe(
          "reply@example.com"
        );
      }
    });

    it("should update existing settings", async () => {
      // Create initial settings
      await db.insert(topicSettings).values({
        organizationId: testOrganization.id,
        confirmationFromName: "Old Name",
        confirmationFromEmail: "old@example.com",
      });

      const result = await updateTopicSettings(testOrganization.id, {
        confirmationFromName: "Updated Name",
        confirmationFromEmail: "updated@example.com",
      });

      expect(result.success).toBe(true);

      // Verify settings were updated
      const getResult = await getTopicSettings(testOrganization.id);
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.settings?.confirmationFromName).toBe("Updated Name");
        expect(getResult.settings?.confirmationFromEmail).toBe(
          "updated@example.com"
        );
      }
    });

    it("should update preference center settings", async () => {
      const result = await updateTopicSettings(testOrganization.id, {
        preferenceCenterTitle: "My Preferences",
        preferenceCenterDescription: "Manage your subscriptions here",
      });

      expect(result.success).toBe(true);

      const getResult = await getTopicSettings(testOrganization.id);
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.settings?.preferenceCenterTitle).toBe(
          "My Preferences"
        );
        expect(getResult.settings?.preferenceCenterDescription).toBe(
          "Manage your subscriptions here"
        );
      }
    });

    it("should allow null values to clear settings", async () => {
      // Create initial settings
      await db.insert(topicSettings).values({
        organizationId: testOrganization.id,
        confirmationFromName: "Company Name",
        confirmationFromEmail: "email@example.com",
      });

      const result = await updateTopicSettings(testOrganization.id, {
        confirmationFromName: null,
        confirmationFromEmail: null,
      });

      expect(result.success).toBe(true);

      const getResult = await getTopicSettings(testOrganization.id);
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.settings?.confirmationFromName).toBeNull();
        expect(getResult.settings?.confirmationFromEmail).toBeNull();
      }
    });

    it("should reject update by regular member", async () => {
      currentMockUserId = testMemberUser.id;

      const result = await updateTopicSettings(testOrganization.id, {
        confirmationFromName: "Hacked Name",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Only owners and admins");
      }
    });
  });

  describe("generatePreferenceCenterPreviewUrl", () => {
    it("should return error when no contacts exist", async () => {
      const result = await generatePreferenceCenterPreviewUrl(
        testOrganization.id
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("No contacts found");
      }
    });

    it("should generate preview URL when contacts exist", async () => {
      // Create a test contact
      await db.insert(contact).values({
        id: "test-preview-contact-1",
        organizationId: testOrganization.id,
        email: "preview@example.com",
        emailHash: "preview-hash",
        status: "active",
        properties: {},
        emailsSent: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        smsSent: 0,
        smsClicked: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await generatePreferenceCenterPreviewUrl(
        testOrganization.id
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.url).toContain("/preferences/");
        // URL should contain a JWT token
        expect(result.url.split("/preferences/")[1]).toBeTruthy();
      }
    });

    it("should allow regular members to generate preview URL", async () => {
      // Create a test contact
      await db.insert(contact).values({
        id: "test-preview-contact-2",
        organizationId: testOrganization.id,
        email: "preview2@example.com",
        emailHash: "preview-hash-2",
        status: "active",
        properties: {},
        emailsSent: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        smsSent: 0,
        smsClicked: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      currentMockUserId = testMemberUser.id;

      const result = await generatePreferenceCenterPreviewUrl(
        testOrganization.id
      );

      expect(result.success).toBe(true);
    });
  });
});
