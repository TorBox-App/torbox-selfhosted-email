import {
  db,
  member,
  organization,
  template,
  templateVersion,
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
  id: "test-template-user-1",
  email: "template-test@example.com",
  name: "Template Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-template-org-1",
  name: "Template Test Org",
  slug: "template-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-template-member-1",
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
});

// Clean up templates before each test
beforeEach(async () => {
  // Delete all templates for this test org
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

describe("Templates API - GET /api/[orgSlug]/templates", () => {
  it("should return empty list when no templates exist", async () => {
    const { GET } = await import("../[orgSlug]/emails/templates/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("should return templates for authorized user", async () => {
    // Create a template first
    await db.insert(template).values({
      id: "test-template-1",
      organizationId: testOrganization.id,
      name: "Test Template",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { GET } = await import("../[orgSlug]/emails/templates/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Test Template");
  });

  it("should filter templates by status", async () => {
    // Create multiple templates with different statuses
    await db.insert(template).values([
      {
        id: "test-template-draft",
        organizationId: testOrganization.id,
        name: "Draft Template",
        content: { type: "doc", content: [] },
        createdBy: testUser.id,
        status: "DRAFT",
      },
      {
        id: "test-template-published",
        organizationId: testOrganization.id,
        name: "Published Template",
        content: { type: "doc", content: [] },
        createdBy: testUser.id,
        status: "PUBLISHED",
      },
    ]);

    const { GET } = await import("../[orgSlug]/emails/templates/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates?status=DRAFT`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("DRAFT");
  });
});

describe("Templates API - POST /api/[orgSlug]/templates", () => {
  it("should create a new template", async () => {
    const { POST } = await import("../[orgSlug]/emails/templates/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "My New Template",
          description: "A test template",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("My New Template");
    expect(data.description).toBe("A test template");
    expect(data.status).toBe("DRAFT");
    expect(data.organizationId).toBe(testOrganization.id);
  });

  it("should require template name", async () => {
    const { POST } = await import("../[orgSlug]/emails/templates/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates`,
      {
        method: "POST",
        body: JSON.stringify({
          description: "Missing name",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Template name is required");
  });

  it("should trim whitespace from name", async () => {
    const { POST } = await import("../[orgSlug]/emails/templates/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "  Trimmed Name  ",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("Trimmed Name");
  });
});

describe("Templates API - GET /api/[orgSlug]/emails/templates/[id]", () => {
  it("should return a single template", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-single",
      organizationId: testOrganization.id,
      name: "Single Template",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { GET } = await import("../[orgSlug]/emails/templates/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-single`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-single",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Single Template");
    expect(data.id).toBe("test-template-single");
  });

  it("should return 404 for non-existent template", async () => {
    const { GET } = await import("../[orgSlug]/emails/templates/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/non-existent`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "non-existent",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Template not found");
  });
});

describe("Templates API - PUT /api/[orgSlug]/emails/templates/[id]", () => {
  it("should update template content", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-update",
      organizationId: testOrganization.id,
      name: "Update Test",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { PUT } = await import("../[orgSlug]/emails/templates/[id]/route");

    const newContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Updated content" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-update`,
      {
        method: "PUT",
        body: JSON.stringify({
          content: newContent,
          createVersion: true,
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toEqual(newContent);

    // Check that a version was created
    const versions = await db.query.templateVersion.findMany({
      where: eq(templateVersion.templateId, "test-template-update"),
    });
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
  });

  it("should update template name and description", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-meta-update",
      organizationId: testOrganization.id,
      name: "Original Name",
      description: "Original description",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { PUT } = await import("../[orgSlug]/emails/templates/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-meta-update`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: "New Name",
          description: "New description",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-meta-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("New Name");
    expect(data.description).toBe("New description");
  });

  it("should update template status", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-status-update",
      organizationId: testOrganization.id,
      name: "Status Test",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { PUT } = await import("../[orgSlug]/emails/templates/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-status-update`,
      {
        method: "PUT",
        body: JSON.stringify({
          status: "PUBLISHED",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-status-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("PUBLISHED");
  });

  it("should return 404 for non-existent template", async () => {
    const { PUT } = await import("../[orgSlug]/emails/templates/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/non-existent`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: "New Name",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "non-existent",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Template not found");
  });
});

describe("Templates API - DELETE /api/[orgSlug]/emails/templates/[id]", () => {
  it("should delete a template", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-delete",
      organizationId: testOrganization.id,
      name: "Delete Test",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { DELETE } = await import("../[orgSlug]/emails/templates/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-delete`,
      {
        method: "DELETE",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-delete",
      }),
    };

    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify template is deleted
    const deleted = await db.query.template.findFirst({
      where: eq(template.id, "test-template-delete"),
    });
    expect(deleted).toBeUndefined();
  });

  it("should return 404 for non-existent template", async () => {
    const { DELETE } = await import("../[orgSlug]/emails/templates/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/non-existent`,
      {
        method: "DELETE",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "non-existent",
      }),
    };

    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Template not found");
  });
});

describe("Templates API - POST /api/[orgSlug]/emails/templates/[id]/duplicate", () => {
  it("should duplicate a template", async () => {
    // Create a template to duplicate
    await db.insert(template).values({
      id: "test-template-original",
      organizationId: testOrganization.id,
      name: "Original Template",
      description: "Original description",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      variables: [{ name: "testVar", defaultValue: "test" }],
      testData: { testVar: "value" },
      createdBy: testUser.id,
      status: "PUBLISHED",
    });

    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/duplicate/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-original/duplicate`,
      {
        method: "POST",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-original",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("Original Template (Copy)");
    expect(data.description).toBe("Original description");
    expect(data.status).toBe("DRAFT"); // Duplicates are always drafts
    expect(data.id).not.toBe("test-template-original");
  });

  it("should return 404 for non-existent template", async () => {
    const { POST } = await import(
      "../[orgSlug]/emails/templates/[id]/duplicate/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/non-existent/duplicate`,
      {
        method: "POST",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "non-existent",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Template not found");
  });
});

describe("Templates API - GET /api/[orgSlug]/emails/templates/[id]/versions", () => {
  it("should return empty list when no versions exist", async () => {
    // Create a template without versions
    await db.insert(template).values({
      id: "test-template-no-versions",
      organizationId: testOrganization.id,
      name: "No Versions Template",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { GET } = await import("../[orgSlug]/emails/templates/[id]/versions/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-no-versions/versions`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-no-versions",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("should return versions for a template", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-with-versions",
      organizationId: testOrganization.id,
      name: "Template With Versions",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    // Create versions
    await db.insert(templateVersion).values([
      {
        templateId: "test-template-with-versions",
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "v1" }] },
          ],
        },
        version: 1,
        createdBy: testUser.id,
      },
      {
        templateId: "test-template-with-versions",
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "v2" }] },
          ],
        },
        version: 2,
        createdBy: testUser.id,
      },
    ]);

    const { GET } = await import("../[orgSlug]/emails/templates/[id]/versions/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-with-versions/versions`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-with-versions",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    // Versions should be ordered by version desc
    expect(data[0].version).toBe(2);
    expect(data[1].version).toBe(1);
  });

  it("should return 404 for non-existent template", async () => {
    const { GET } = await import("../[orgSlug]/emails/templates/[id]/versions/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/non-existent/versions`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "non-existent",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Template not found");
  });
});

describe("Templates API - GET /api/[orgSlug]/emails/templates/[id]/versions/[versionId]", () => {
  it("should return a specific version", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-version-get",
      organizationId: testOrganization.id,
      name: "Version Get Test",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    // Create a version
    const [version] = await db
      .insert(templateVersion)
      .values({
        templateId: "test-template-version-get",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        version: 1,
        createdBy: testUser.id,
      })
      .returning();

    const { GET } = await import(
      "../[orgSlug]/emails/templates/[id]/versions/[versionId]/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-version-get/versions/${version.id}`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-version-get",
        versionId: version.id,
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.version).toBe(1);
    expect(data.id).toBe(version.id);
  });

  it("should return 404 for non-existent version", async () => {
    // Create a template
    await db.insert(template).values({
      id: "test-template-version-404",
      organizationId: testOrganization.id,
      name: "Version 404 Test",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      status: "DRAFT",
    });

    const { GET } = await import(
      "../[orgSlug]/emails/templates/[id]/versions/[versionId]/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/emails/templates/test-template-version-404/versions/non-existent`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-template-version-404",
        versionId: "non-existent",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Version not found");
  });
});

describe("Templates API - Authorization", () => {
  it("should return 403 for unauthorized organization", async () => {
    const { GET } = await import("../[orgSlug]/emails/templates/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/templates"
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org" }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });
});
