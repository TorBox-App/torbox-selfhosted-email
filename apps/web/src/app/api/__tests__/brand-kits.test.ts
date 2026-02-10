import { brandKit, db, member, organization, template, user } from "@wraps/db";
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
  id: "test-brandkits-user-1",
  email: "brandkits-test@example.com",
  name: "Brand Kits Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-brandkits-org-1",
  name: "Brand Kits Test Org",
  slug: "brandkits-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-brandkits-member-1",
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

// Mock brand kit HTML extractor
vi.mock("@/lib/brand-kit/extract-from-html", () => ({
  extractBrandKitFromHtml: vi.fn((html: string, name: string) => ({
    primaryColor: "#e74c3c",
    secondaryColor: "#3498db",
    backgroundColor: "#f5f5f5",
    textColor: "#333333",
    fontFamily: "'Helvetica Neue', sans-serif",
    headingFontFamily: null,
    logoUrl: "https://example.com/logo.png",
    companyName: null,
    sourceDomain: "",
    buttonStyle: "rounded",
    buttonRadius: "8px",
  })),
}));

// Mock brand kit extractor
vi.mock("@/lib/brand-kit/extractor", () => ({
  extractBrandKitFromDomain: vi.fn(async (domain: string) => ({
    primaryColor: "#5046e5",
    secondaryColor: "#6366f1",
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    fontFamily: "system-ui, sans-serif",
    logoUrl: `https://${domain}/logo.png`,
    companyName:
      domain.split(".")[0].charAt(0).toUpperCase() +
      domain.split(".")[0].slice(1),
    sourceDomain: domain,
  })),
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

// Clean up brand kits and templates before each test
beforeEach(async () => {
  await db
    .delete(brandKit)
    .where(eq(brandKit.organizationId, testOrganization.id));
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
});

// Clean up after all tests
afterAll(async () => {
  await db
    .delete(template)
    .where(eq(template.organizationId, testOrganization.id));
  await db
    .delete(brandKit)
    .where(eq(brandKit.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.organizationId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

describe("Brand Kits API - GET /api/[orgSlug]/brand-kits", () => {
  it("should return empty list when no brand kits exist", async () => {
    const { GET } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("should return brand kits for authorized user", async () => {
    // Create a brand kit first
    await db.insert(brandKit).values({
      id: "test-brandkit-1",
      organizationId: testOrganization.id,
      name: "Test Brand Kit",
      primaryColor: "#5046e5",
      isDefault: true,
    });

    const { GET } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Test Brand Kit");
  });

  it("should order brand kits with default first", async () => {
    // Create multiple brand kits
    await db.insert(brandKit).values([
      {
        id: "test-brandkit-nondefault",
        organizationId: testOrganization.id,
        name: "Non-Default Kit",
        primaryColor: "#ff0000",
        isDefault: false,
      },
      {
        id: "test-brandkit-default",
        organizationId: testOrganization.id,
        name: "Default Kit",
        primaryColor: "#00ff00",
        isDefault: true,
      },
    ]);

    const { GET } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].isDefault).toBe(true);
    expect(data[0].name).toBe("Default Kit");
  });
});

describe("Brand Kits API - POST /api/[orgSlug]/brand-kits", () => {
  it("should create a new brand kit with defaults", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "My New Brand Kit",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("My New Brand Kit");
    expect(data.primaryColor).toBe("#5046e5");
    expect(data.secondaryColor).toBe("#6366f1");
    expect(data.backgroundColor).toBe("#ffffff");
    expect(data.textColor).toBe("#1f2937");
    expect(data.fontFamily).toBe("system-ui, sans-serif");
    expect(data.isDefault).toBe(true); // First brand kit is default
  });

  it("should create brand kit with custom values", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Custom Brand Kit",
          primaryColor: "#ff0000",
          secondaryColor: "#00ff00",
          backgroundColor: "#0000ff",
          textColor: "#ffffff",
          fontFamily: "Arial, sans-serif",
          buttonStyle: "pill",
          buttonRadius: "999px",
          companyName: "Test Company",
          logoUrl: "https://example.com/logo.png",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.primaryColor).toBe("#ff0000");
    expect(data.secondaryColor).toBe("#00ff00");
    expect(data.backgroundColor).toBe("#0000ff");
    expect(data.textColor).toBe("#ffffff");
    expect(data.fontFamily).toBe("Arial, sans-serif");
    expect(data.buttonStyle).toBe("pill");
    expect(data.buttonRadius).toBe("999px");
    expect(data.companyName).toBe("Test Company");
    expect(data.logoUrl).toBe("https://example.com/logo.png");
  });

  it("should default name to 'Untitled Brand Kit' if not provided", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("Untitled Brand Kit");
  });

  it("should set first brand kit as default", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "First Brand Kit",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.isDefault).toBe(true);
  });

  it("should not set subsequent brand kits as default unless specified", async () => {
    // Create first brand kit
    await db.insert(brandKit).values({
      id: "test-first-kit",
      organizationId: testOrganization.id,
      name: "First Kit",
      primaryColor: "#5046e5",
      isDefault: true,
    });

    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Second Brand Kit",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.isDefault).toBe(false);
  });

  it("should allow setting new brand kit as default", async () => {
    // Create first brand kit
    await db.insert(brandKit).values({
      id: "test-first-kit",
      organizationId: testOrganization.id,
      name: "First Kit",
      primaryColor: "#5046e5",
      isDefault: true,
    });

    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "New Default Kit",
          isDefault: true,
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.isDefault).toBe(true);

    // Verify old kit is no longer default
    const oldKit = await db.query.brandKit.findFirst({
      where: eq(brandKit.id, "test-first-kit"),
    });
    expect(oldKit?.isDefault).toBe(false);
  });

  it("should trim whitespace from name", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits`,
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

describe("Brand Kits API - GET /api/[orgSlug]/brand-kits/[id]", () => {
  it("should return a single brand kit", async () => {
    // Create a brand kit
    await db.insert(brandKit).values({
      id: "test-brandkit-single",
      organizationId: testOrganization.id,
      name: "Single Brand Kit",
      primaryColor: "#5046e5",
      isDefault: true,
    });

    const { GET } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-single`
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-single",
      }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Single Brand Kit");
    expect(data.id).toBe("test-brandkit-single");
  });

  it("should return 404 for non-existent brand kit", async () => {
    const { GET } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/non-existent`
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
    expect(data.error).toBe("Brand kit not found");
  });
});

describe("Brand Kits API - PUT /api/[orgSlug]/brand-kits/[id]", () => {
  it("should update brand kit colors", async () => {
    // Create a brand kit
    await db.insert(brandKit).values({
      id: "test-brandkit-update",
      organizationId: testOrganization.id,
      name: "Update Test",
      primaryColor: "#5046e5",
      secondaryColor: "#6366f1",
      isDefault: true,
    });

    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-update`,
      {
        method: "PUT",
        body: JSON.stringify({
          primaryColor: "#ff0000",
          secondaryColor: "#00ff00",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.primaryColor).toBe("#ff0000");
    expect(data.secondaryColor).toBe("#00ff00");
  });

  it("should update brand kit name", async () => {
    // Create a brand kit
    await db.insert(brandKit).values({
      id: "test-brandkit-name-update",
      organizationId: testOrganization.id,
      name: "Original Name",
      primaryColor: "#5046e5",
      isDefault: true,
    });

    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-name-update`,
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
        id: "test-brandkit-name-update",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("New Name");
  });

  it("should update brand kit typography", async () => {
    // Create a brand kit
    await db.insert(brandKit).values({
      id: "test-brandkit-typography",
      organizationId: testOrganization.id,
      name: "Typography Test",
      primaryColor: "#5046e5",
      fontFamily: "system-ui, sans-serif",
      isDefault: true,
    });

    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-typography`,
      {
        method: "PUT",
        body: JSON.stringify({
          fontFamily: "Georgia, serif",
          headingFontFamily: "Impact, sans-serif",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-typography",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fontFamily).toBe("Georgia, serif");
    expect(data.headingFontFamily).toBe("Impact, sans-serif");
  });

  it("should update brand kit button style", async () => {
    // Create a brand kit
    await db.insert(brandKit).values({
      id: "test-brandkit-button",
      organizationId: testOrganization.id,
      name: "Button Test",
      primaryColor: "#5046e5",
      buttonStyle: "rounded",
      buttonRadius: "4px",
      isDefault: true,
    });

    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-button`,
      {
        method: "PUT",
        body: JSON.stringify({
          buttonStyle: "pill",
          buttonRadius: "999px",
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-button",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.buttonStyle).toBe("pill");
    expect(data.buttonRadius).toBe("999px");
  });

  it("should update company information", async () => {
    // Create a brand kit
    await db.insert(brandKit).values({
      id: "test-brandkit-company",
      organizationId: testOrganization.id,
      name: "Company Test",
      primaryColor: "#5046e5",
      isDefault: true,
    });

    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-company`,
      {
        method: "PUT",
        body: JSON.stringify({
          companyName: "Acme Inc",
          companyAddress: "123 Main St, City, ST 12345",
          socialLinks: [
            { platform: "twitter", url: "https://twitter.com/acme" },
            { platform: "linkedin", url: "https://linkedin.com/company/acme" },
          ],
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-company",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.companyName).toBe("Acme Inc");
    expect(data.companyAddress).toBe("123 Main St, City, ST 12345");
    expect(data.socialLinks).toHaveLength(2);
  });

  it("should return 404 for non-existent brand kit", async () => {
    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/non-existent`,
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
    expect(data.error).toBe("Brand kit not found");
  });

  it("should allow clearing optional fields", async () => {
    // Create a brand kit with optional fields
    await db.insert(brandKit).values({
      id: "test-brandkit-clear",
      organizationId: testOrganization.id,
      name: "Clear Test",
      primaryColor: "#5046e5",
      logoUrl: "https://example.com/logo.png",
      headingFontFamily: "Impact, sans-serif",
      companyName: "Acme Inc",
      isDefault: true,
    });

    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-clear`,
      {
        method: "PUT",
        body: JSON.stringify({
          logoUrl: null,
          headingFontFamily: null,
          companyName: null,
        }),
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-clear",
      }),
    };

    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logoUrl).toBeNull();
    expect(data.headingFontFamily).toBeNull();
    expect(data.companyName).toBeNull();
  });
});

describe("Brand Kits API - DELETE /api/[orgSlug]/brand-kits/[id]", () => {
  it("should delete a brand kit", async () => {
    // Create a brand kit
    await db.insert(brandKit).values({
      id: "test-brandkit-delete",
      organizationId: testOrganization.id,
      name: "Delete Test",
      primaryColor: "#5046e5",
      isDefault: true,
    });

    const { DELETE } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-delete`,
      {
        method: "DELETE",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-delete",
      }),
    };

    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify brand kit is deleted
    const deleted = await db.query.brandKit.findFirst({
      where: eq(brandKit.id, "test-brandkit-delete"),
    });
    expect(deleted).toBeUndefined();
  });

  it("should promote another kit to default when deleting default", async () => {
    // Create two brand kits
    await db.insert(brandKit).values([
      {
        id: "test-brandkit-default-to-delete",
        organizationId: testOrganization.id,
        name: "Default Kit",
        primaryColor: "#5046e5",
        isDefault: true,
      },
      {
        id: "test-brandkit-will-become-default",
        organizationId: testOrganization.id,
        name: "Will Become Default",
        primaryColor: "#ff0000",
        isDefault: false,
      },
    ]);

    const { DELETE } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-default-to-delete`,
      {
        method: "DELETE",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-default-to-delete",
      }),
    };

    const response = await DELETE(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify remaining kit became default
    const remaining = await db.query.brandKit.findFirst({
      where: eq(brandKit.id, "test-brandkit-will-become-default"),
    });
    expect(remaining?.isDefault).toBe(true);
  });

  it("should return 404 for non-existent brand kit", async () => {
    const { DELETE } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/non-existent`,
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
    expect(data.error).toBe("Brand kit not found");
  });
});

describe("Brand Kits API - POST /api/[orgSlug]/brand-kits/[id]/default", () => {
  it("should set brand kit as default", async () => {
    // Create two brand kits
    await db.insert(brandKit).values([
      {
        id: "test-brandkit-old-default",
        organizationId: testOrganization.id,
        name: "Old Default",
        primaryColor: "#5046e5",
        isDefault: true,
      },
      {
        id: "test-brandkit-new-default",
        organizationId: testOrganization.id,
        name: "New Default",
        primaryColor: "#ff0000",
        isDefault: false,
      },
    ]);

    const { POST } = await import("../[orgSlug]/brand-kits/[id]/default/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/test-brandkit-new-default/default`,
      {
        method: "POST",
      }
    );
    const context = {
      params: Promise.resolve({
        orgSlug: testOrganization.slug,
        id: "test-brandkit-new-default",
      }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isDefault).toBe(true);

    // Verify old default is no longer default
    const oldDefault = await db.query.brandKit.findFirst({
      where: eq(brandKit.id, "test-brandkit-old-default"),
    });
    expect(oldDefault?.isDefault).toBe(false);
  });

  it("should return 404 for non-existent brand kit", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/[id]/default/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/non-existent/default`,
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
    expect(data.error).toBe("Brand kit not found");
  });
});

describe("Brand Kits API - POST /api/[orgSlug]/brand-kits/extract", () => {
  it("should extract brand kit from valid domain", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/extract/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/extract`,
      {
        method: "POST",
        body: JSON.stringify({
          domain: "example.com",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.brandKit).toBeDefined();
    expect(data.brandKit.autoExtracted).toBe(true);
    expect(data.brandKit.sourceDomain).toBe("example.com");
  });

  it("should clean domain from URL", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/extract/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/extract`,
      {
        method: "POST",
        body: JSON.stringify({
          domain: "https://example.com/some/path",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.brandKit.sourceDomain).toBe("example.com");
  });

  it("should require domain parameter", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/extract/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/extract`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Domain is required");
  });

  it("should reject invalid domain format", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/extract/route");

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/extract`,
      {
        method: "POST",
        body: JSON.stringify({
          domain: "not a valid domain",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid domain format");
  });
});

describe("Brand Kits API - Authorization", () => {
  it("should return 403 for unauthorized organization", async () => {
    const { GET } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits"
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org" }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 403 for unauthorized single brand kit access", async () => {
    const { GET } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits/some-id"
    );
    const context = {
      params: Promise.resolve({ orgSlug: "unauthorized-org", id: "some-id" }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 403 for unauthorized brand kit creation", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Test Brand Kit",
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

  it("should return 403 for unauthorized brand kit update", async () => {
    const { PUT } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits/some-id",
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

  it("should return 403 for unauthorized brand kit deletion", async () => {
    const { DELETE } = await import("../[orgSlug]/brand-kits/[id]/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits/some-id",
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

  it("should return 403 for unauthorized default setting", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/[id]/default/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits/some-id/default",
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

  it("should return 403 for unauthorized brand extraction", async () => {
    const { POST } = await import("../[orgSlug]/brand-kits/extract/route");

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits/extract",
      {
        method: "POST",
        body: JSON.stringify({
          domain: "example.com",
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

  it("should return 403 for unauthorized template extraction", async () => {
    const { POST } = await import(
      "../[orgSlug]/brand-kits/from-template/route"
    );

    const request = new Request(
      "http://localhost/api/unauthorized-org/brand-kits/from-template",
      {
        method: "POST",
        body: JSON.stringify({
          templateId: "some-id",
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
});

describe("Brand Kits API - POST /api/[orgSlug]/brand-kits/from-template", () => {
  it("should require templateId parameter", async () => {
    const { POST } = await import(
      "../[orgSlug]/brand-kits/from-template/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/from-template`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Template ID is required");
  });

  it("should return 404 for non-existent template", async () => {
    const { POST } = await import(
      "../[orgSlug]/brand-kits/from-template/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/from-template`,
      {
        method: "POST",
        body: JSON.stringify({ templateId: "non-existent-template" }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Template not found");
  });

  it("should return 400 for non-react-email template", async () => {
    // Create a tiptap template (not react-email)
    await db.insert(template).values({
      id: "test-brandkit-tiptap-template",
      organizationId: testOrganization.id,
      name: "TipTap Template",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      sourceFormat: "tiptap",
    });

    const { POST } = await import(
      "../[orgSlug]/brand-kits/from-template/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/from-template`,
      {
        method: "POST",
        body: JSON.stringify({ templateId: "test-brandkit-tiptap-template" }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("react-email");
  });

  it("should return 400 for react-email template without compiledHtml", async () => {
    // Create a react-email template without compiled HTML
    await db.insert(template).values({
      id: "test-brandkit-no-html-template",
      organizationId: testOrganization.id,
      name: "No HTML Template",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      sourceFormat: "react-email",
      compiledHtml: null,
    });

    const { POST } = await import(
      "../[orgSlug]/brand-kits/from-template/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/from-template`,
      {
        method: "POST",
        body: JSON.stringify({
          templateId: "test-brandkit-no-html-template",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("react-email");
  });

  it("should extract brand kit from react-email template", async () => {
    // Create a react-email template with compiled HTML
    await db.insert(template).values({
      id: "test-brandkit-react-email-template",
      organizationId: testOrganization.id,
      name: "Welcome Email",
      content: { type: "doc", content: [] },
      createdBy: testUser.id,
      sourceFormat: "react-email",
      compiledHtml:
        '<html><body><div style="background-color: #e74c3c;">Hello</div></body></html>',
    });

    const { POST } = await import(
      "../[orgSlug]/brand-kits/from-template/route"
    );

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/brand-kits/from-template`,
      {
        method: "POST",
        body: JSON.stringify({
          templateId: "test-brandkit-react-email-template",
        }),
      }
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.brandKit).toBeDefined();
    expect(data.brandKit.autoExtracted).toBe(true);
    expect(data.brandKit.name).toBe("Brand from Welcome Email");
    expect(data.brandKit.primaryColor).toBeDefined();
    expect(data.brandKit.fontFamily).toBeDefined();
    expect(data.brandKit.buttonStyle).toBeDefined();
    expect(data.brandKit.buttonRadius).toBeDefined();
  });
});
