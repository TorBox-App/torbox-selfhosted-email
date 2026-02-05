import {
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

// Test data
const testUser = {
  id: "test-compile-user-1",
  email: "compile-test@example.com",
  name: "Compile Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-compile-org-1",
  name: "Compile Test Org",
  slug: "compile-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-compile-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
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
          id: "session-compile-123",
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

// Mock logger
vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
  serializeError: (e: unknown) => e,
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
    .insert(member)
    .values(testMember)
    .onConflictDoUpdate({ target: member.id, set: { role: testMember.role } });
});

// Clean up templates before each test
beforeEach(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
});

// Clean up after all tests
afterAll(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.organizationId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

const VALID_TSX_SOURCE = `
import { Html, Head, Body, Container, Text } from "@react-email/components";

export const subject = "Welcome!";
export const emailType = "transactional";

export default function WelcomeEmail(props: { name?: string }) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hello {props.name}!</Text>
        </Container>
      </Body>
    </Html>
  );
}
`.trim();

describe("Compile API - POST /api/[orgSlug]/emails/templates/[id]/compile", () => {
  it("should compile valid TSX source", async () => {
    // Create a code template
    await db.insert(template).values({
      id: "test-compile-tmpl-1",
      organizationId: testOrganization.id,
      name: "Compile Test",
      content: {},
      status: "DRAFT",
      createdBy: testUser.id,
      sourceFormat: "react-email",
      source: "// placeholder",
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/compile/route"
    );

    const request = new Request("http://localhost/api/compile-test-org/emails/templates/test-compile-tmpl-1/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: VALID_TSX_SOURCE }),
    });

    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-compile-tmpl-1",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.compiledHtml).toContain("Hello");
    expect(data.compiledHtml).toContain("{{name}}");
    expect(data.compiledText).toBeDefined();
    expect(data.subject).toBe("Welcome!");
    expect(data.emailType).toBe("transactional");
    expect(data.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "name" }),
      ])
    );
  });

  it("should return 422 for syntax errors in TSX", async () => {
    await db.insert(template).values({
      id: "test-compile-tmpl-2",
      organizationId: testOrganization.id,
      name: "Bad TSX",
      content: {},
      status: "DRAFT",
      createdBy: testUser.id,
      sourceFormat: "react-email",
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/compile/route"
    );

    const request = new Request("http://localhost/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "export default function() { return <<<<invalid" }),
    });

    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-compile-tmpl-2",
      }),
    };

    const response = await POST(request, context);
    expect(response.status).toBe(422);

    const data = await response.json();
    expect(data.error).toBe("Compilation failed");
    expect(data.message).toBeDefined();
  });

  it("should return 422 when template has no default export", async () => {
    await db.insert(template).values({
      id: "test-compile-tmpl-3",
      organizationId: testOrganization.id,
      name: "No Default Export",
      content: {},
      status: "DRAFT",
      createdBy: testUser.id,
      sourceFormat: "react-email",
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/compile/route"
    );

    const request = new Request("http://localhost/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: `export const subject = "Hello";`,
      }),
    });

    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-compile-tmpl-3",
      }),
    };

    const response = await POST(request, context);
    expect(response.status).toBe(422);

    const data = await response.json();
    expect(data.error).toContain("default export");
  });

  it("should return 400 when source is missing", async () => {
    await db.insert(template).values({
      id: "test-compile-tmpl-4",
      organizationId: testOrganization.id,
      name: "No Source",
      content: {},
      status: "DRAFT",
      createdBy: testUser.id,
      sourceFormat: "react-email",
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/compile/route"
    );

    const request = new Request("http://localhost/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-compile-tmpl-4",
      }),
    };

    const response = await POST(request, context);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("source is required");
  });

  it("should return 404 for non-existent template", async () => {
    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/compile/route"
    );

    const request = new Request("http://localhost/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: VALID_TSX_SOURCE }),
    });

    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "nonexistent-template",
      }),
    };

    const response = await POST(request, context);
    expect(response.status).toBe(404);
  });
});
