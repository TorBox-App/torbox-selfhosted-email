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

/**
 * Tests that publish/unpublish route handlers scope their UPDATE queries
 * by organizationId (defense-in-depth). We bypass the org-scoped READ
 * via mocks, then verify the WRITE doesn't affect wrong-org templates.
 */

// Test data — use unique IDs to avoid collisions with other test files
const testUser = {
  id: "test-publish-route-user-1",
  email: "publish-route-test@example.com",
  name: "Publish Route Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-publish-route-org-1",
  name: "Publish Route Test Org",
  slug: "publish-route-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-publish-route-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testAwsAccount = {
  id: "test-publish-route-aws-account",
  organizationId: testOrganization.id,
  name: "Test AWS Account",
  accountId: "123456789012",
  region: "us-east-1",
  roleArn: "arn:aws:iam::123456789012:role/test-role",
  externalId: `test-external-id-publish-route-${Date.now()}`,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// A fake "wrong" org that will be returned by getOrganizationWithMembership
const wrongOrg = {
  id: "completely-wrong-org-id-for-publish",
  name: "Wrong Org",
  slug: "publish-route-test-org", // Same slug so the mock matches
};

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

// Mock the auth module
vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        session: {
          id: "session-publish-route",
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

// Mock organization helper to return the WRONG org ID
// This simulates the auth passing but returning a different org than the template's
vi.mock("@/lib/organization", () => ({
  getOrganizationWithMembership: vi.fn(async () => wrongOrg),
}));

// Mock AWS credential cache
vi.mock("@/lib/aws/credential-cache", () => ({
  getOrAssumeRole: vi.fn(async () => ({
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    sessionToken: "test-token",
  })),
}));

// Mock SES utilities
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
  toPlainText: vi.fn(() => "Test"),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
  serializeError: (e: unknown) => e,
}));

// Import route handlers AFTER mocks are set up
const { POST, DELETE } = await import(
  "../[orgSlug]/emails/templates/[id]/publish/route"
);

// Helper to create test templates
async function createTestTemplate(
  overrides: Partial<typeof template.$inferInsert> = {}
) {
  const id = `test-pub-rt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

// Helper to create route context
function createContext(id: string) {
  return {
    params: Promise.resolve({
      orgSlug: testOrganization.slug,
      id,
    }),
  };
}

// Set up test database
beforeAll(async () => {
  await db
    .insert(user)
    .values(testUser)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });

  await db
    .insert(organization)
    .values(testOrganization)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: testOrganization.name },
    });

  await db
    .insert(member)
    .values(testMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMember.role },
    });

  await db
    .insert(awsAccount)
    .values(testAwsAccount)
    .onConflictDoUpdate({
      target: awsAccount.id,
      set: { updatedAt: new Date() },
    });
});

beforeEach(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
  mockUpsertSESTemplate.mockClear();
  mockDeleteSESTemplate.mockClear();
});

afterAll(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
  await db.delete(awsAccount).where(eq(awsAccount.id, testAwsAccount.id));
  await db.delete(member).where(eq(member.id, testMember.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

describe("POST /publish - organizationId scoping", () => {
  it("should scope the publish update WHERE clause by organizationId (defense-in-depth)", async () => {
    const id = await createTestTemplate({
      name: "Org Scoped Publish Route",
      subject: "Test Subject",
      status: "DRAFT",
      channel: "email",
      sourceFormat: "react-email",
      compiledHtml: "<html><body>Test</body></html>",
    });

    // Read the real template for mocking the findFirst bypass
    const templateData = await db.query.template.findFirst({
      where: eq(template.id, id),
    });

    // Spy on reads to bypass org scoping — the mock org helper returns wrongOrg.id,
    // so the findFirst would normally return null. We bypass to test the write path.
    const templateFindSpy = vi
      .spyOn(db.query.template, "findFirst")
      .mockResolvedValueOnce(templateData);
    const awsFindSpy = vi
      .spyOn(db.query.awsAccount, "findFirst")
      .mockResolvedValueOnce(testAwsAccount as never);

    const request = new Request(
      "http://localhost/api/test-org/emails/templates/test/publish",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    await POST(request, createContext(id));

    // Restore spies before DB query
    templateFindSpy.mockRestore();
    awsFindSpy.mockRestore();

    // Template should NOT be updated because write WHERE uses wrongOrg.id
    // which doesn't match the template's actual organizationId
    const afterAttempt = await db.query.template.findFirst({
      where: eq(template.id, id),
    });
    expect(afterAttempt?.status).toBe("DRAFT");
    expect(afterAttempt?.publishedAt).toBeNull();
  });
});

describe("DELETE /publish - organizationId scoping", () => {
  it("should scope the unpublish update WHERE clause by organizationId (defense-in-depth)", async () => {
    const id = await createTestTemplate({
      name: "Org Scoped Unpublish Route",
      subject: "Test Subject",
      status: "PUBLISHED",
      sesTemplateName: "wraps-test-unpublish-scope",
      publishedAt: new Date(),
      channel: "email",
    });

    // Read the real template for mocking
    const templateData = await db.query.template.findFirst({
      where: eq(template.id, id),
    });

    // Spy on reads to bypass org scoping
    const templateFindSpy = vi
      .spyOn(db.query.template, "findFirst")
      .mockResolvedValueOnce(templateData);
    const awsFindSpy = vi
      .spyOn(db.query.awsAccount, "findFirst")
      .mockResolvedValueOnce(testAwsAccount as never);

    const request = new Request(
      "http://localhost/api/test-org/emails/templates/test/publish",
      {
        method: "DELETE",
      }
    );

    await DELETE(request, createContext(id));

    // Restore spies
    templateFindSpy.mockRestore();
    awsFindSpy.mockRestore();

    // Template should NOT be updated because write WHERE uses wrongOrg.id
    const afterAttempt = await db.query.template.findFirst({
      where: eq(template.id, id),
    });
    expect(afterAttempt?.status).toBe("PUBLISHED");
    expect(afterAttempt?.sesTemplateName).toBe("wraps-test-unpublish-scope");
  });
});
