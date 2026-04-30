import {
  awsAccount,
  db,
  member,
  organization,
  template,
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
  bulkDeleteTemplates,
  bulkUpdateTemplateStatus,
  bulkUpdateTemplateType,
  publishTemplateToSES,
} from "../templates";

// Test data
const testUser = {
  id: "test-templates-bulk-user-1",
  email: "templates-bulk-test@example.com",
  name: "Templates Bulk Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-templates-bulk-org-1",
  name: "Templates Bulk Test Org",
  slug: "templates-bulk-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMemberOwner = {
  id: "test-templates-bulk-member-owner",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

// Secondary user for role testing
const testUserMember = {
  id: "test-templates-bulk-user-member",
  email: "templates-bulk-member@example.com",
  name: "Templates Bulk Member User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testMemberRegular = {
  id: "test-templates-bulk-member-regular",
  organizationId: testOrganization.id,
  userId: testUserMember.id,
  role: "billing" as const,
  createdAt: new Date(),
};

// Test AWS account for SES publishing
const testAwsAccount = {
  id: "test-templates-bulk-aws-account",
  organizationId: testOrganization.id,
  name: "Test AWS Account",
  accountId: "123456789012",
  region: "us-east-1",
  roleArn: "arn:aws:iam::123456789012:role/test-role",
  externalId: `test-external-id-${Date.now()}`,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Variable to control which user is "logged in" for tests
let currentUserId = testUser.id;
let currentUserEmail = testUser.email;

// Mock the auth module
vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: {
          id: currentUserId,
          email: currentUserEmail,
          name: "Test User",
        },
        session: {
          id: "session-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: currentUserId,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      })),
    },
  },
}));

// Mock the AWS/SES dependencies to allow publishTemplateToSES to succeed
vi.mock("@/lib/aws/credential-cache", () => ({
  getOrAssumeRole: vi.fn(async () => ({
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    sessionToken: "test-token",
  })),
}));

const { mockDeleteSESTemplate, mockUpsertSESTemplate } = vi.hoisted(() => ({
  mockDeleteSESTemplate: vi.fn(async () => {}),
  mockUpsertSESTemplate: vi.fn(async () => {}),
}));

vi.mock("@wraps/email", () => ({
  deleteSESTemplate: mockDeleteSESTemplate,
  generateSESTemplateName: vi.fn((id: string, _name: string) => `wraps-${id}`),
  transformVariablesForSes: vi.fn((text: string) => text),
  upsertSESTemplate: mockUpsertSESTemplate,
}));

vi.mock("@react-email/render", () => ({
  render: vi.fn(async () => "<html><body>Test</body></html>"),
  toPlainText: vi.fn(() => "Test"),
}));

// Mock activation tracking
vi.mock("@/lib/activation-tracking", () => ({
  trackTemplatePublished: vi.fn(),
}));

// Mock the tiptap serializer
vi.mock("@/lib/serializers/tiptap-to-react-email", () => ({
  tiptapToReactEmail: vi.fn(() => null),
  toBrandKitColors: vi.fn(() => {}),
}));

// Helper to create test templates
async function createTestTemplate(
  overrides: Partial<typeof template.$inferInsert> = {}
) {
  const id = `test-template-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date();
  await db.insert(template).values({
    id,
    organizationId: testOrganization.id,
    name: `Test Template ${id}`,
    content: { type: "doc", content: [] },
    sourceFormat: "tiptap",
    status: "DRAFT",
    emailType: "marketing",
    createdAt: now,
    updatedAt: now,
    createdBy: testUser.id,
    ...overrides,
  });
  return id;
}

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
    .values(testUserMember)
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
    .values(testMemberOwner)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMemberOwner.role },
    });

  await db
    .insert(member)
    .values(testMemberRegular)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMemberRegular.role },
    });

  // Insert test AWS account (required for SES publishing)
  await db
    .insert(awsAccount)
    .values(testAwsAccount)
    .onConflictDoUpdate({
      target: awsAccount.id,
      set: { updatedAt: new Date() },
    });
});

// Clean up templates before each test and reset user
beforeEach(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
  // Reset to owner user
  currentUserId = testUser.id;
  currentUserEmail = testUser.email;
});

// Clean up after all tests
afterAll(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
  await db.delete(awsAccount).where(eq(awsAccount.id, testAwsAccount.id));
  await db.delete(member).where(eq(member.id, testMemberOwner.id));
  await db.delete(member).where(eq(member.id, testMemberRegular.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
  await db.delete(user).where(eq(user.id, testUserMember.id));
});

describe("Template Bulk Actions", () => {
  describe("bulkDeleteTemplates", () => {
    it("should delete multiple templates", async () => {
      const id1 = await createTestTemplate({ name: "Delete Me 1" });
      const id2 = await createTestTemplate({ name: "Delete Me 2" });
      const id3 = await createTestTemplate({ name: "Delete Me 3" });

      const result = await bulkDeleteTemplates(testOrganization.id, [
        id1,
        id2,
        id3,
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(3);
      }

      // Verify templates are deleted
      const remaining = await db.query.template.findMany({
        where: eq(template.organizationId, testOrganization.id),
      });
      expect(remaining).toHaveLength(0);
    });

    it("should return error when no templates selected", async () => {
      const result = await bulkDeleteTemplates(testOrganization.id, []);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("No templates selected");
      }
    });

    it("should deny billing-role user (no content access)", async () => {
      const id1 = await createTestTemplate({ name: "Cannot Delete" });

      // Switch to billing user (no content access)
      currentUserId = testUserMember.id;
      currentUserEmail = testUserMember.email;

      const result = await bulkDeleteTemplates(testOrganization.id, [id1]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("permission");
      }

      // Verify template still exists
      const remaining = await db.query.template.findFirst({
        where: eq(template.id, id1),
      });
      expect(remaining).not.toBeNull();
    });

    it("should only delete templates in the specified organization", async () => {
      const id1 = await createTestTemplate({ name: "In Org" });

      // Try to delete with wrong org ID
      const result = await bulkDeleteTemplates("wrong-org-id", [id1]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("You don't have access to this organization");
      }

      // Verify template still exists
      const remaining = await db.query.template.findFirst({
        where: eq(template.id, id1),
      });
      expect(remaining).not.toBeNull();
    });

    it("should delete published templates from SES", async () => {
      // Reset the mock
      mockDeleteSESTemplate.mockClear();

      // Create a template with sesTemplateName (simulating a published template)
      const id1 = await createTestTemplate({
        name: "Published Template",
        status: "PUBLISHED",
        sesTemplateName: "wraps-published-template-123",
      });
      const id2 = await createTestTemplate({
        name: "Draft Template",
        status: "DRAFT",
        sesTemplateName: null,
      });

      const result = await bulkDeleteTemplates(testOrganization.id, [id1, id2]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(2);
      }

      // Verify deleteSESTemplate was called once for the published template
      expect(mockDeleteSESTemplate).toHaveBeenCalledTimes(1);
      expect(mockDeleteSESTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          accessKeyId: "test-key",
          secretAccessKey: "test-secret",
        }),
        "us-east-1",
        "wraps-published-template-123"
      );

      // Verify both templates are deleted from DB
      const remaining = await db.query.template.findMany({
        where: eq(template.organizationId, testOrganization.id),
      });
      expect(remaining).toHaveLength(0);
    });
  });

  describe("bulkUpdateTemplateType", () => {
    it("should update multiple templates to marketing type", async () => {
      const id1 = await createTestTemplate({
        name: "Type Change 1",
        emailType: "transactional",
      });
      const id2 = await createTestTemplate({
        name: "Type Change 2",
        emailType: "transactional",
      });

      const result = await bulkUpdateTemplateType(
        testOrganization.id,
        [id1, id2],
        "marketing"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(2);
      }

      // Verify types are updated
      const updated = await db.query.template.findMany({
        where: eq(template.organizationId, testOrganization.id),
      });
      expect(updated.every((t) => t.emailType === "marketing")).toBe(true);
    });

    it("should update multiple templates to transactional type", async () => {
      const id1 = await createTestTemplate({
        name: "Type Change 1",
        emailType: "marketing",
      });
      const id2 = await createTestTemplate({
        name: "Type Change 2",
        emailType: "marketing",
      });

      const result = await bulkUpdateTemplateType(
        testOrganization.id,
        [id1, id2],
        "transactional"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(2);
      }

      // Verify types are updated
      const updated = await db.query.template.findMany({
        where: eq(template.organizationId, testOrganization.id),
      });
      expect(updated.every((t) => t.emailType === "transactional")).toBe(true);
    });

    it("should return error when no templates selected", async () => {
      const result = await bulkUpdateTemplateType(
        testOrganization.id,
        [],
        "marketing"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("No templates selected");
      }
    });

    it("should return error for invalid email type", async () => {
      const id1 = await createTestTemplate({ name: "Invalid Type" });

      const result = await bulkUpdateTemplateType(
        testOrganization.id,
        [id1],
        "invalid" as "marketing"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid email type");
      }
    });
  });

  describe("bulkUpdateTemplateStatus", () => {
    describe("DRAFT status", () => {
      it("should update multiple templates to DRAFT", async () => {
        const id1 = await createTestTemplate({
          name: "Status Change 1",
          status: "ARCHIVED",
        });
        const id2 = await createTestTemplate({
          name: "Status Change 2",
          status: "ARCHIVED",
        });

        const result = await bulkUpdateTemplateStatus(
          testOrganization.id,
          [id1, id2],
          "DRAFT"
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.updated).toBe(2);
          expect(result.published).toBe(0);
          expect(result.skipped).toHaveLength(0);
          expect(result.errors).toHaveLength(0);
        }

        // Verify statuses are updated
        const updated = await db.query.template.findMany({
          where: eq(template.organizationId, testOrganization.id),
        });
        expect(updated.every((t) => t.status === "DRAFT")).toBe(true);
      });
    });

    describe("ARCHIVED status", () => {
      it("should update multiple templates to ARCHIVED", async () => {
        const id1 = await createTestTemplate({
          name: "Status Change 1",
          status: "DRAFT",
        });
        const id2 = await createTestTemplate({
          name: "Status Change 2",
          status: "DRAFT",
        });

        const result = await bulkUpdateTemplateStatus(
          testOrganization.id,
          [id1, id2],
          "ARCHIVED"
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.updated).toBe(2);
          expect(result.published).toBe(0);
          expect(result.skipped).toHaveLength(0);
          expect(result.errors).toHaveLength(0);
        }

        // Verify statuses are updated
        const updated = await db.query.template.findMany({
          where: eq(template.organizationId, testOrganization.id),
        });
        expect(updated.every((t) => t.status === "ARCHIVED")).toBe(true);
      });
    });

    describe("PUBLISHED status", () => {
      it("should publish templates with subjects to SES", async () => {
        const id1 = await createTestTemplate({
          name: "Has Subject 1",
          subject: "Test Subject 1",
          status: "DRAFT",
        });
        const id2 = await createTestTemplate({
          name: "Has Subject 2",
          subject: "Test Subject 2",
          status: "DRAFT",
        });

        const result = await bulkUpdateTemplateStatus(
          testOrganization.id,
          [id1, id2],
          "PUBLISHED"
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.updated).toBe(2);
          expect(result.published).toBe(2);
          expect(result.skipped).toHaveLength(0);
          expect(result.errors).toHaveLength(0);
        }

        // Verify statuses are updated
        const updated = await db.query.template.findMany({
          where: eq(template.organizationId, testOrganization.id),
        });
        expect(updated.every((t) => t.status === "PUBLISHED")).toBe(true);
        expect(updated.every((t) => t.sesTemplateName !== null)).toBe(true);
      });

      it("should skip templates without subjects for SES publishing", async () => {
        const id1 = await createTestTemplate({
          name: "Has Subject",
          subject: "Test Subject",
          status: "DRAFT",
        });
        const id2 = await createTestTemplate({
          name: "No Subject",
          subject: null,
          status: "DRAFT",
        });

        const result = await bulkUpdateTemplateStatus(
          testOrganization.id,
          [id1, id2],
          "PUBLISHED"
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.updated).toBe(2);
          expect(result.published).toBe(1);
          expect(result.skipped).toHaveLength(1);
          expect(result.skipped[0]).toBe("No Subject");
          expect(result.errors).toHaveLength(0);
        }

        // Both should have PUBLISHED status
        const updated = await db.query.template.findMany({
          where: eq(template.organizationId, testOrganization.id),
        });
        expect(updated.every((t) => t.status === "PUBLISHED")).toBe(true);

        // Only template with subject should have sesTemplateName
        const withSubject = updated.find((t) => t.name === "Has Subject");
        const noSubject = updated.find((t) => t.name === "No Subject");
        expect(withSubject?.sesTemplateName).not.toBeNull();
        expect(noSubject?.sesTemplateName).toBeNull();
      });

      it("should handle all templates missing subjects", async () => {
        const id1 = await createTestTemplate({
          name: "No Subject 1",
          subject: null,
          status: "DRAFT",
        });
        const id2 = await createTestTemplate({
          name: "No Subject 2",
          subject: null,
          status: "DRAFT",
        });

        const result = await bulkUpdateTemplateStatus(
          testOrganization.id,
          [id1, id2],
          "PUBLISHED"
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.updated).toBe(2);
          expect(result.published).toBe(0);
          expect(result.skipped).toHaveLength(2);
          expect(result.errors).toHaveLength(0);
        }

        // Both should still be PUBLISHED (status change is independent of SES)
        const updated = await db.query.template.findMany({
          where: eq(template.organizationId, testOrganization.id),
        });
        expect(updated.every((t) => t.status === "PUBLISHED")).toBe(true);
      });
    });

    it("should return error when no templates selected", async () => {
      const result = await bulkUpdateTemplateStatus(
        testOrganization.id,
        [],
        "DRAFT"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("No templates selected");
      }
    });

    it("should return error for invalid status", async () => {
      const id1 = await createTestTemplate({ name: "Invalid Status" });

      const result = await bulkUpdateTemplateStatus(
        testOrganization.id,
        [id1],
        "INVALID" as "DRAFT"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid status");
      }
    });
  });
});

describe("publishTemplateToSES - SMS Channel", () => {
  it("should publish SMS template without calling SES", async () => {
    mockUpsertSESTemplate.mockClear();

    const id = await createTestTemplate({
      name: "SMS Template",
      channel: "sms",
      compiledText: "Hello {{contact.firstName}}!",
      status: "DRAFT",
    });

    const result = await publishTemplateToSES(id, testOrganization.id);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sesTemplateName).toBe("");
    }

    // SES should NOT have been called
    expect(mockUpsertSESTemplate).not.toHaveBeenCalled();

    // Template should be PUBLISHED in the DB
    const updated = await db.query.template.findFirst({
      where: eq(template.id, id),
    });
    expect(updated?.status).toBe("PUBLISHED");
    expect(updated?.publishedAt).not.toBeNull();
  });

  it("should publish email template via SES as normal", async () => {
    mockUpsertSESTemplate.mockClear();

    const id = await createTestTemplate({
      name: "Email Template",
      channel: "email",
      subject: "Welcome!",
      status: "DRAFT",
    });

    const result = await publishTemplateToSES(id, testOrganization.id);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sesTemplateName).not.toBe("");
    }

    // SES SHOULD have been called
    expect(mockUpsertSESTemplate).toHaveBeenCalledTimes(1);

    // Template should be PUBLISHED in the DB with sesTemplateName
    const updated = await db.query.template.findFirst({
      where: eq(template.id, id),
    });
    expect(updated?.status).toBe("PUBLISHED");
    expect(updated?.sesTemplateName).not.toBeNull();
  });
});

describe("publishTemplateToSES - organizationId scoping", () => {
  it("should scope the update WHERE clause by organizationId (defense-in-depth)", async () => {
    mockUpsertSESTemplate.mockClear();

    // Create template in testOrganization (org-A)
    const id = await createTestTemplate({
      name: "Org Scoped Publish",
      subject: "Test Subject",
      status: "DRAFT",
      channel: "email",
    });

    // Read the real template data for mocking
    const templateData = await db.query.template.findFirst({
      where: eq(template.id, id),
    });

    // Bypass the org-scoped READ by mocking findFirst to return the template
    // regardless of which organizationId is passed. This simulates a hypothetical
    // read-path bypass to verify the WRITE path has its own org scoping.
    const templateFindSpy = vi
      .spyOn(db.query.template, "findFirst")
      .mockResolvedValueOnce(templateData);
    const awsFindSpy = vi
      .spyOn(db.query.awsAccount, "findFirst")
      .mockResolvedValueOnce(testAwsAccount as never);

    // Call with WRONG organizationId — reads are bypassed, but write should be scoped
    await publishTemplateToSES(id, "completely-wrong-org-id");

    // Restore spies before querying the real DB
    templateFindSpy.mockRestore();
    awsFindSpy.mockRestore();

    // The write WHERE clause should include organizationId = "completely-wrong-org-id"
    // which won't match the template (actual org = testOrganization.id), so no update.
    const afterAttempt = await db.query.template.findFirst({
      where: eq(template.id, id),
    });
    expect(afterAttempt?.status).toBe("DRAFT");
    expect(afterAttempt?.publishedAt).toBeNull();
  });

  it("should scope the SMS update WHERE clause by organizationId (defense-in-depth)", async () => {
    // Create SMS template in testOrganization (org-A)
    const id = await createTestTemplate({
      name: "Org Scoped SMS",
      status: "DRAFT",
      channel: "sms",
    });

    // Read the real template data for mocking
    const templateData = await db.query.template.findFirst({
      where: eq(template.id, id),
    });

    // Bypass the org-scoped READ
    const templateFindSpy = vi
      .spyOn(db.query.template, "findFirst")
      .mockResolvedValueOnce(templateData);

    // Call with WRONG organizationId — SMS path doesn't need AWS account
    await publishTemplateToSES(id, "completely-wrong-org-id");

    // Restore spies
    templateFindSpy.mockRestore();

    // Template should NOT be updated
    const afterAttempt = await db.query.template.findFirst({
      where: eq(template.id, id),
    });
    expect(afterAttempt?.status).toBe("DRAFT");
    expect(afterAttempt?.publishedAt).toBeNull();
  });
});
