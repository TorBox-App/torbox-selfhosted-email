import { db, member, organization, reusableBlock, user } from "@wraps/db";
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
  id: "test-blocks-user-1",
  email: "blocks-test@example.com",
  name: "Blocks Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-blocks-org-1",
  name: "Blocks Test Org",
  slug: "blocks-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-blocks-member-1",
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
        userRole: testMember.role,
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

// Clean up blocks before each test
beforeEach(async () => {
  // Delete all blocks for this test org
  await db
    .delete(reusableBlock)
    .where(eq(reusableBlock.organizationId, testOrganization.id));
});

// Clean up after all tests
afterAll(async () => {
  await db
    .delete(reusableBlock)
    .where(eq(reusableBlock.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.organizationId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

describe("Blocks API - GET /api/[orgSlug]/blocks", () => {
  it("should return empty list when no blocks exist", async () => {
    const { GET } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("should return blocks for authorized user", async () => {
    // Create a block first
    await db.insert(reusableBlock).values({
      id: "test-block-1",
      organizationId: testOrganization.id,
      name: "Test Block",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
    });

    const { GET } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Test Block");
  });

  it("should filter blocks by category", async () => {
    // Create multiple blocks with different categories
    await db.insert(reusableBlock).values([
      {
        id: "test-block-header",
        organizationId: testOrganization.id,
        name: "Header Block",
        content: { type: "doc", content: [] },
        category: "header",
        createdBy: testUser.id,
      },
      {
        id: "test-block-footer",
        organizationId: testOrganization.id,
        name: "Footer Block",
        content: { type: "doc", content: [] },
        category: "footer",
        createdBy: testUser.id,
      },
    ]);

    const { GET } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks?category=header`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].category).toBe("header");
  });

  it("should return all blocks when category is 'all'", async () => {
    // Create multiple blocks with different categories
    await db.insert(reusableBlock).values([
      {
        id: "test-block-all-1",
        organizationId: testOrganization.id,
        name: "Block 1",
        content: { type: "doc", content: [] },
        category: "header",
        createdBy: testUser.id,
      },
      {
        id: "test-block-all-2",
        organizationId: testOrganization.id,
        name: "Block 2",
        content: { type: "doc", content: [] },
        category: "footer",
        createdBy: testUser.id,
      },
    ]);

    const { GET } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks?category=all`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
  });

  it("should include public blocks from same org", async () => {
    // Create a public block from the same org
    await db.insert(reusableBlock).values({
      id: "test-public-block",
      organizationId: testOrganization.id, // Same org with public flag
      name: "Public Block",
      content: { type: "doc", content: [] },
      category: "custom",
      isPublic: true,
      createdBy: testUser.id,
    });

    const { GET } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.some((b: { name: string }) => b.name === "Public Block")).toBe(
      true
    );
    expect(data.some((b: { isPublic: boolean }) => b.isPublic)).toBe(true);
  });
});

describe("Blocks API - POST /api/[orgSlug]/blocks", () => {
  it("should create a new block", async () => {
    const { POST } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "My New Block",
          description: "A test block",
          content: { type: "doc", content: [{ type: "paragraph" }] },
          category: "custom",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("My New Block");
    expect(data.description).toBe("A test block");
    expect(data.category).toBe("custom");
    expect(data.organizationId).toBe(testOrganization.id);
  });

  it("should require block name", async () => {
    const { POST } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({
          description: "Missing name",
          content: { type: "doc", content: [] },
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Block name is required");
  });

  it("should require block content", async () => {
    const { POST } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Missing Content Block",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Block content is required");
  });

  it("should trim whitespace from name and description", async () => {
    const { POST } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "  Trimmed Name  ",
          description: "  Trimmed Description  ",
          content: { type: "doc", content: [] },
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
    expect(data.description).toBe("Trimmed Description");
  });

  it("should default category to 'custom'", async () => {
    const { POST } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Default Category Block",
          content: { type: "doc", content: [] },
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.category).toBe("custom");
  });
});

describe("Blocks API - GET /api/[orgSlug]/blocks/[id]", () => {
  it("should return a single block", async () => {
    // Create a block
    await db.insert(reusableBlock).values({
      id: "test-block-single",
      organizationId: testOrganization.id,
      name: "Single Block",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
    });

    const { GET } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/test-block-single`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-block-single",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Single Block");
    expect(data.id).toBe("test-block-single");
  });

  it("should return 404 for non-existent block", async () => {
    const { GET } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/non-existent`
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
    expect(data.error).toBe("Block not found");
  });
});

describe("Blocks API - PUT /api/[orgSlug]/blocks/[id]", () => {
  it("should update block content", async () => {
    // Create a block
    await db.insert(reusableBlock).values({
      id: "test-block-update",
      organizationId: testOrganization.id,
      name: "Update Test",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
    });

    const { PUT } = await import("../[orgSlug]/blocks/[id]/route");

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
      `http://localhost/api/${testOrganization.slug}/blocks/test-block-update`,
      {
        method: "PUT",
        body: JSON.stringify({
          content: newContent,
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-block-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toEqual(newContent);
  });

  it("should update block name and description", async () => {
    // Create a block
    await db.insert(reusableBlock).values({
      id: "test-block-meta-update",
      organizationId: testOrganization.id,
      name: "Original Name",
      description: "Original description",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
    });

    const { PUT } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/test-block-meta-update`,
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
        id: "test-block-meta-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("New Name");
    expect(data.description).toBe("New description");
  });

  it("should update block category", async () => {
    // Create a block
    await db.insert(reusableBlock).values({
      id: "test-block-cat-update",
      organizationId: testOrganization.id,
      name: "Category Test",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
    });

    const { PUT } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/test-block-cat-update`,
      {
        method: "PUT",
        body: JSON.stringify({
          category: "header",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-block-cat-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.category).toBe("header");
  });

  it("should return 404 for non-existent block", async () => {
    const { PUT } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/non-existent`,
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
    expect(data.error).toBe("Block not found");
  });

  it("should allow clearing description by setting to null", async () => {
    // Create a block with description
    await db.insert(reusableBlock).values({
      id: "test-block-clear-desc",
      organizationId: testOrganization.id,
      name: "Clear Desc Test",
      description: "Original description",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
    });

    const { PUT } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/test-block-clear-desc`,
      {
        method: "PUT",
        body: JSON.stringify({
          description: null,
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-block-clear-desc",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.description).toBeNull();
  });
});

describe("Blocks API - DELETE /api/[orgSlug]/blocks/[id]", () => {
  it("should delete a block", async () => {
    // Create a block
    await db.insert(reusableBlock).values({
      id: "test-block-delete",
      organizationId: testOrganization.id,
      name: "Delete Test",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
    });

    const { DELETE } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/test-block-delete`,
      {
        method: "DELETE",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-block-delete",
      }),
    };

    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify block is deleted
    const deleted = await db.query.reusableBlock.findFirst({
      where: eq(reusableBlock.id, "test-block-delete"),
    });
    expect(deleted).toBeUndefined();
  });

  it("should succeed even for non-existent block (idempotent)", async () => {
    const { DELETE } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/non-existent`,
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

    // DELETE is idempotent - returns success even if block didn't exist
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe("Blocks API - POST /api/[orgSlug]/blocks/[id]/use", () => {
  it("should increment usage count", async () => {
    // Create a block with initial usage count of 0
    await db.insert(reusableBlock).values({
      id: "test-block-use",
      organizationId: testOrganization.id,
      name: "Usage Test",
      content: { type: "doc", content: [] },
      category: "custom",
      createdBy: testUser.id,
      usageCount: 0,
    });

    const { POST } = await import("../[orgSlug]/blocks/[id]/use/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/test-block-use/use`,
      {
        method: "POST",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-block-use",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.usageCount).toBe(1);

    // Call again to verify increment
    const response2 = await POST(request, context);
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.usageCount).toBe(2);
  });

  it("should return 404 for non-existent block", async () => {
    const { POST } = await import("../[orgSlug]/blocks/[id]/use/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/blocks/non-existent/use`,
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
    expect(data.error).toBe("Block not found");
  });
});

describe("Blocks API - Authorization", () => {
  it("should return 403 for unauthorized organization", async () => {
    const { GET } = await import("../[orgSlug]/blocks/route");

    const request = new Request("http://localhost/api/unauthorized-org/blocks");
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org" }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 403 for unauthorized single block access", async () => {
    const { GET } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/blocks/some-id"
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org", id: "some-id" }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 403 for unauthorized block creation", async () => {
    const { POST } = await import("../[orgSlug]/blocks/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/blocks",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Test Block",
          content: { type: "doc", content: [] },
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org" }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 403 for unauthorized block update", async () => {
    const { PUT } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/blocks/some-id",
      {
        method: "PUT",
        body: JSON.stringify({
          name: "New Name",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org", id: "some-id" }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 403 for unauthorized block deletion", async () => {
    const { DELETE } = await import("../[orgSlug]/blocks/[id]/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/blocks/some-id",
      {
        method: "DELETE",
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org", id: "some-id" }),
    };

    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 403 for unauthorized usage tracking", async () => {
    const { POST } = await import("../[orgSlug]/blocks/[id]/use/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/blocks/some-id/use",
      {
        method: "POST",
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org", id: "some-id" }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });
});
