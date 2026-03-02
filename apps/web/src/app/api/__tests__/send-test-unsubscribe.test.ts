/**
 * Test: Marketing template test emails should contain valid unsubscribe + preference center links
 *
 * The send-test route generates real JWT-based unsubscribe and preference center URLs
 * for marketing templates when the recipient is an existing contact. If the recipient
 * is not a known contact, the route sends the email with a warning (no contact creation
 * side effect) and the placeholder variables remain unresolved.
 */

import { createHash } from "node:crypto";
import {
  awsAccount,
  contact,
  db,
  member,
  organization,
  organizationExtension,
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

// Test data
const testUser = {
  id: "test-send-test-user-1",
  email: "send-test-user@example.com",
  name: "Send Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-send-test-org-1",
  name: "Send Test Org",
  slug: "send-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-send-test-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testAwsAccount = {
  id: "test-send-test-aws-account",
  organizationId: testOrganization.id,
  name: "Test AWS Account",
  accountId: "123456789012",
  region: "us-east-1",
  roleArn: "arn:aws:iam::123456789012:role/test-role",
  externalId: "test-send-test-external-id",
  createdAt: new Date(),
  updatedAt: new Date(),
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

// Mock organization helper
vi.mock("@/lib/organization", () => ({
  getOrganizationWithMembership: vi.fn(async (slug: string, userId: string) => {
    if (slug === testOrganization.slug && userId === testUser.id) {
      return {
        id: testOrganization.id,
        name: testOrganization.name,
        slug: testOrganization.slug,
      };
    }
    return null;
  }),
}));

// Mock AWS credential cache
vi.mock("@/lib/aws/credential-cache", () => ({
  getOrAssumeRole: vi.fn(async () => ({
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    sessionToken: "test-token",
  })),
}));

// Capture what was sent via WrapsEmail.send()
let lastSentEmail: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
} | null = null;

vi.mock("@wraps.dev/email", () => ({
  WrapsEmail: class MockWrapsEmail {
    async send(params: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    }) {
      lastSentEmail = params;
      return { messageId: "test-message-id" };
    }
  },
}));

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
    .insert(organizationExtension)
    .values({
      organizationId: testOrganization.id,
      defaultFrom: "hello@example.com",
      defaultFromName: "Test Sender",
      awsAccountCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: organizationExtension.organizationId,
      set: { defaultFrom: "hello@example.com", updatedAt: new Date() },
    });

  await db
    .insert(member)
    .values(testMember)
    .onConflictDoUpdate({ target: member.id, set: { role: testMember.role } });

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
  await db
    .delete(contact)
    .where(eq(contact.organizationId, testOrganization.id));
  lastSentEmail = null;
});

afterAll(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
  await db
    .delete(contact)
    .where(eq(contact.organizationId, testOrganization.id));
  await db
    .delete(awsAccount)
    .where(eq(awsAccount.organizationId, testOrganization.id));
  await db
    .delete(organizationExtension)
    .where(eq(organizationExtension.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.organizationId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

// Helper: create a contact so the route can look it up by email hash
async function createTestContact(email: string) {
  const emailHash = createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
  await db
    .insert(contact)
    .values({
      organizationId: testOrganization.id,
      email: email.toLowerCase().trim(),
      emailHash,
      emailStatus: "active",
    })
    .onConflictDoNothing();
}

describe("Send Test Email - Unsubscribe/Preference Links", () => {
  it("should inject valid unsubscribe URL when recipient is an existing contact (code-pushed)", async () => {
    await createTestContact("recipient@example.com");

    // Create a marketing template with unsubscribe variable in compiled HTML
    await db.insert(template).values({
      id: "test-marketing-template-unsub",
      organizationId: testOrganization.id,
      name: "Marketing Template",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "PUBLISHED",
      emailType: "marketing",
      sourceFormat: "react-email",
      compiledHtml:
        '<html><body><p>Hello!</p><a href="{{unsubscribeUrl}}">Unsubscribe</a></body></html>',
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/send-test/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-marketing-template-unsub/send-test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: ["recipient@example.com"],
          subject: "Test Subject",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-marketing-template-unsub",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // The HTML sent should NOT contain the raw {{unsubscribeUrl}} placeholder
    expect(lastSentEmail).not.toBeNull();
    expect(lastSentEmail!.html).not.toContain("{{unsubscribeUrl}}");

    // The unsubscribe link should be a valid URL pointing to the API unsubscribe endpoint
    // It should match the pattern: https://api.wraps.dev/unsubscribe/<jwt-token>
    // or http://localhost:3001/unsubscribe/<jwt-token> in dev
    expect(lastSentEmail!.html).toMatch(
      /href="https?:\/\/[^"]+\/unsubscribe\/[A-Za-z0-9_\-.]+"/
    );
  });

  it("should inject valid preferences URL when recipient is an existing contact (code-pushed)", async () => {
    await createTestContact("recipient@example.com");

    // Create a marketing template with preferences variable in compiled HTML
    await db.insert(template).values({
      id: "test-marketing-template-prefs",
      organizationId: testOrganization.id,
      name: "Marketing Template Prefs",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "PUBLISHED",
      emailType: "marketing",
      sourceFormat: "react-email",
      compiledHtml:
        '<html><body><p>Hello!</p><a href="{{preferencesUrl}}">Manage Preferences</a></body></html>',
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/send-test/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-marketing-template-prefs/send-test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: ["recipient@example.com"],
          subject: "Test Subject",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-marketing-template-prefs",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // The HTML sent should NOT contain the raw {{preferencesUrl}} placeholder
    expect(lastSentEmail).not.toBeNull();
    expect(lastSentEmail!.html).not.toContain("{{preferencesUrl}}");

    // The preferences link should be a valid URL pointing to the app preferences endpoint
    // It should match the pattern: https://app.wraps.dev/preferences/<jwt-token>
    expect(lastSentEmail!.html).toMatch(
      /href="https?:\/\/[^"]+\/preferences\/[A-Za-z0-9_\-.]+"/
    );
  });

  it("should inject both URLs when recipient is an existing contact (code-pushed)", async () => {
    await createTestContact("recipient@example.com");

    await db.insert(template).values({
      id: "test-marketing-template-both",
      organizationId: testOrganization.id,
      name: "Marketing Template Both Links",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "PUBLISHED",
      emailType: "marketing",
      sourceFormat: "react-email",
      compiledHtml: [
        "<html><body>",
        "<p>Hello {{firstName}}!</p>",
        '<a href="{{unsubscribeUrl}}">Unsubscribe</a>',
        '<a href="{{preferencesUrl}}">Manage Preferences</a>',
        "</body></html>",
      ].join(""),
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/send-test/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-marketing-template-both/send-test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: ["recipient@example.com"],
          subject: "Test Subject",
          testData: { firstName: "Jane" },
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-marketing-template-both",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    expect(lastSentEmail).not.toBeNull();

    // Neither placeholder should remain
    expect(lastSentEmail!.html).not.toContain("{{unsubscribeUrl}}");
    expect(lastSentEmail!.html).not.toContain("{{preferencesUrl}}");

    // Both URLs should be real URLs with JWT tokens
    expect(lastSentEmail!.html).toMatch(
      /href="https?:\/\/[^"]+\/unsubscribe\/[A-Za-z0-9_\-.]+"/
    );
    expect(lastSentEmail!.html).toMatch(
      /href="https?:\/\/[^"]+\/preferences\/[A-Za-z0-9_\-.]+"/
    );

    // Regular testData variable should still be substituted
    expect(lastSentEmail!.html).toContain("Jane");
    expect(lastSentEmail!.html).not.toContain("{{firstName}}");
  });

  it("should NOT inject unsubscribe URLs for transactional templates", async () => {
    await db.insert(template).values({
      id: "test-transactional-template",
      organizationId: testOrganization.id,
      name: "Transactional Template",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "PUBLISHED",
      emailType: "transactional",
      sourceFormat: "react-email",
      compiledHtml: "<html><body><p>Your order has shipped.</p></body></html>",
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/send-test/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-transactional-template/send-test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: ["recipient@example.com"],
          subject: "Order Shipped",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-transactional-template",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Transactional emails should NOT have unsubscribe links injected
    expect(lastSentEmail).not.toBeNull();
    expect(lastSentEmail!.html).not.toContain("unsubscribe");
    expect(lastSentEmail!.html).not.toContain("preferences");
  });

  it("should inject valid unsubscribe URL into TipTap-rendered marketing template", async () => {
    await createTestContact("recipient@example.com");

    // Create a marketing template using TipTap content (not code-pushed)
    // that includes unsubscribe variable
    await db.insert(template).values({
      id: "test-marketing-tiptap-unsub",
      organizationId: testOrganization.id,
      name: "TipTap Marketing Template",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello!" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Click here to " },
              {
                type: "text",
                text: "unsubscribe",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "{{unsubscribeUrl}}" },
                  },
                ],
              },
            ],
          },
        ],
      },
      createdBy: testUser.id,
      status: "PUBLISHED",
      emailType: "marketing",
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/send-test/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-marketing-tiptap-unsub/send-test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: ["recipient@example.com"],
          subject: "Test Subject",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-marketing-tiptap-unsub",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // The rendered HTML should NOT contain the raw {{unsubscribeUrl}} placeholder
    expect(lastSentEmail).not.toBeNull();
    expect(lastSentEmail!.html).not.toContain("{{unsubscribeUrl}}");

    // Should contain a real unsubscribe URL
    expect(lastSentEmail!.html).toMatch(
      /https?:\/\/[^"]+\/unsubscribe\/[A-Za-z0-9_\-.]+/
    );
  });

  it("should return a warning and skip marketing URLs when recipient is not an existing contact", async () => {
    // Do NOT create a contact — send to an unknown address
    await db.insert(template).values({
      id: "test-marketing-no-contact",
      organizationId: testOrganization.id,
      name: "Marketing No Contact",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "PUBLISHED",
      emailType: "marketing",
      sourceFormat: "react-email",
      compiledHtml:
        '<html><body><a href="{{unsubscribeUrl}}">Unsubscribe</a></body></html>',
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/send-test/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-marketing-no-contact/send-test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: ["unknown@example.com"],
          subject: "Test Subject",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-marketing-no-contact",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Should include a warning about the missing contact
    expect(data.warnings).toHaveLength(1);
    expect(data.warnings[0]).toContain("unknown@example.com");
    expect(data.warnings[0]).toContain("not an existing contact");

    // The placeholder should remain unresolved since no URLs were generated
    expect(lastSentEmail).not.toBeNull();
    expect(lastSentEmail!.html).toContain("{{unsubscribeUrl}}");
  });
});
