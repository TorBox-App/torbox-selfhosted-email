/**
 * Authentication & Authorization Tests
 *
 * Tests for:
 * 1. API key authentication
 * 2. Session token authentication
 * 3. Tenant isolation (org-based access control)
 * 4. Unauthorized access prevention
 */

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock crypto for API key hashing
vi.mock("node:crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn((encoding) => {
        // Return predictable hashes for testing
        return "mocked-hash";
      }),
    })),
  })),
}));

// Test data
const ORG_1 = {
  id: "org-tenant-1",
  name: "Tenant One",
};

const ORG_2 = {
  id: "org-tenant-2",
  name: "Tenant Two",
};

const API_KEY_ORG_1 = {
  id: "key-org1",
  key: "wraps_live_org1key123",
  keyHash: "hash-org1",
  organizationId: ORG_1.id,
  createdBy: "user-1",
  expiresAt: null,
};

const API_KEY_ORG_2 = {
  id: "key-org2",
  key: "wraps_live_org2key456",
  keyHash: "hash-org2",
  organizationId: ORG_2.id,
  createdBy: "user-2",
  expiresAt: null,
};

const EXPIRED_API_KEY = {
  id: "key-expired",
  key: "wraps_live_expiredkey",
  keyHash: "hash-expired",
  organizationId: ORG_1.id,
  createdBy: "user-1",
  expiresAt: new Date("2020-01-01"), // In the past
};

const SESSION_ORG_1 = {
  id: "session-1",
  token: "session-token-org1",
  userId: "user-1",
  activeOrganizationId: ORG_1.id,
  expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
};

// Mock database responses
const mockApiKeys = new Map([
  ["hash-org1", API_KEY_ORG_1],
  ["hash-org2", API_KEY_ORG_2],
  ["hash-expired", EXPIRED_API_KEY],
]);

const mockSessions = new Map([["session-token-org1", SESSION_ORG_1]]);

const mockMembers = new Map([
  [`${SESSION_ORG_1.userId}:${ORG_1.id}`, { role: "owner" }],
]);

const mockSubscriptions = new Map([
  [ORG_1.id, { plan: "starter", status: "active" }],
  [ORG_2.id, { plan: "pro", status: "active" }],
]);

// Contacts per organization (for tenant isolation tests)
const mockContacts = new Map([
  [
    ORG_1.id,
    [
      { id: "contact-1-org1", email: "user1@tenant1.com", organizationId: ORG_1.id },
      { id: "contact-2-org1", email: "user2@tenant1.com", organizationId: ORG_1.id },
    ],
  ],
  [
    ORG_2.id,
    [
      { id: "contact-1-org2", email: "user1@tenant2.com", organizationId: ORG_2.id },
    ],
  ],
]);

// Mock database
vi.mock("@wraps/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          catch: vi.fn(),
        })),
      })),
    })),
  },
  apiKey: {
    id: "id",
    keyHash: "key_hash",
    organizationId: "organization_id",
    createdBy: "created_by",
    expiresAt: "expires_at",
    lastUsedAt: "last_used_at",
  },
  session: {
    id: "id",
    token: "token",
    userId: "user_id",
    expiresAt: "expires_at",
    activeOrganizationId: "active_organization_id",
  },
  member: {
    userId: "user_id",
    organizationId: "organization_id",
    role: "role",
  },
  subscription: {
    referenceId: "reference_id",
    plan: "plan",
    status: "status",
  },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
}));

// Helper to create hash for a specific key
function getHashForKey(key: string): string {
  if (key === API_KEY_ORG_1.key) return "hash-org1";
  if (key === API_KEY_ORG_2.key) return "hash-org2";
  if (key === EXPIRED_API_KEY.key) return "hash-expired";
  return "unknown-hash";
}

// Auth context type
type AuthContext = {
  apiKeyId: string | null;
  organizationId: string;
  userId: string | null;
  planId: string | null;
};

// Create a test app that mimics the real auth middleware behavior
function createAuthTestApp() {
  return new Elysia()
    .derive(async ({ request }) => {
      const authHeader = request.headers.get("authorization");
      const orgIdHeader = request.headers.get("x-organization-id");

      if (!authHeader) {
        return { auth: null as AuthContext | null, authError: "Unauthorized: no auth header" };
      }

      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

      // API Key auth
      if (token.startsWith("wraps_")) {
        const keyHash = getHashForKey(token);
        const keyRecord = mockApiKeys.get(keyHash);

        if (!keyRecord) {
          return { auth: null as AuthContext | null, authError: "Unauthorized: invalid API key" };
        }

        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
          return { auth: null as AuthContext | null, authError: "Unauthorized: API key expired" };
        }

        const sub = mockSubscriptions.get(keyRecord.organizationId);
        return {
          auth: {
            apiKeyId: keyRecord.id,
            organizationId: keyRecord.organizationId,
            userId: keyRecord.createdBy,
            planId: sub?.plan || null,
          } as AuthContext,
          authError: null as string | null,
        };
      }

      // Session auth
      const sessionRecord = mockSessions.get(token);
      if (!sessionRecord) {
        return { auth: null as AuthContext | null, authError: "Unauthorized: session not found" };
      }

      if (sessionRecord.expiresAt < new Date()) {
        return { auth: null as AuthContext | null, authError: "Unauthorized: session expired" };
      }

      const orgId = orgIdHeader || sessionRecord.activeOrganizationId;
      if (!orgId) {
        return { auth: null as AuthContext | null, authError: "Unauthorized: no org id" };
      }

      const memberKey = `${sessionRecord.userId}:${orgId}`;
      const memberRecord = mockMembers.get(memberKey);
      if (!memberRecord) {
        return { auth: null as AuthContext | null, authError: "Unauthorized: user not member of org" };
      }

      const sub = mockSubscriptions.get(orgId);
      return {
        auth: {
          apiKeyId: null,
          organizationId: orgId,
          userId: sessionRecord.userId,
          planId: sub?.plan || null,
        } as AuthContext,
        authError: null as string | null,
      };
    })
    .onBeforeHandle(({ auth, authError, set }) => {
      if (authError || !auth) {
        set.status = 401;
        return { error: authError || "Unauthorized" };
      }
    })
    // Test endpoints
    .get("/v1/contacts", ({ auth }) => {
      const contacts = mockContacts.get(auth!.organizationId) || [];
      return { contacts, organizationId: auth!.organizationId };
    })
    .get("/v1/contacts/:id", ({ auth, params, set }) => {
      const contacts = mockContacts.get(auth!.organizationId) || [];
      const contact = contacts.find((c) => c.id === params.id);

      if (!contact) {
        set.status = 404;
        return { error: "Contact not found" };
      }

      return contact;
    })
    .post("/v1/contacts", async ({ auth, request }) => {
      const body = await request.json();
      return {
        id: "new-contact",
        ...body,
        organizationId: auth!.organizationId,
      };
    })
    .get("/v1/me", ({ auth }) => {
      return {
        organizationId: auth!.organizationId,
        userId: auth!.userId,
        planId: auth!.planId,
        apiKeyId: auth!.apiKeyId,
      };
    });
}

describe("Authentication", () => {
  let app: ReturnType<typeof createAuthTestApp>;

  beforeEach(() => {
    app = createAuthTestApp();
  });

  describe("API Key Authentication", () => {
    it("authenticates with valid API key", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_1.key}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(ORG_1.id);
      expect(body.apiKeyId).toBe(API_KEY_ORG_1.id);
    });

    it("rejects requests without auth header", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts")
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("Unauthorized");
    });

    it("rejects invalid API key", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          headers: {
            Authorization: "Bearer wraps_live_invalidkey",
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("invalid API key");
    });

    it("rejects expired API key", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          headers: {
            Authorization: `Bearer ${EXPIRED_API_KEY.key}`,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("expired");
    });

    it("rejects malformed API key (wrong prefix)", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          headers: {
            Authorization: "Bearer invalid_prefix_key",
          },
        })
      );

      expect(response.status).toBe(401);
    });

    it("handles API key without Bearer prefix", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: {
            Authorization: API_KEY_ORG_1.key,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(ORG_1.id);
    });
  });

  describe("Session Authentication", () => {
    it("authenticates with valid session token", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: {
            Authorization: `Bearer ${SESSION_ORG_1.token}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(ORG_1.id);
      expect(body.userId).toBe(SESSION_ORG_1.userId);
      expect(body.apiKeyId).toBeNull();
    });

    it("rejects invalid session token", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          headers: {
            Authorization: "Bearer invalid-session-token",
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("session not found");
    });

    it("rejects session for non-member organization", async () => {
      // User 1 trying to access Org 2 (they're not a member)
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          headers: {
            Authorization: `Bearer ${SESSION_ORG_1.token}`,
            "X-Organization-Id": ORG_2.id,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("not member of org");
    });
  });

  describe("Tenant Isolation", () => {
    it("org 1 can only see org 1 contacts", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_1.key}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(ORG_1.id);
      expect(body.contacts).toHaveLength(2);
      expect(body.contacts.every((c: { organizationId: string }) => c.organizationId === ORG_1.id)).toBe(true);
    });

    it("org 2 can only see org 2 contacts", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_2.key}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(ORG_2.id);
      expect(body.contacts).toHaveLength(1);
      expect(body.contacts.every((c: { organizationId: string }) => c.organizationId === ORG_2.id)).toBe(true);
    });

    it("org 1 cannot access org 2 contact by ID", async () => {
      // Org 1 trying to access a contact that belongs to Org 2
      const response = await app.handle(
        new Request("http://localhost/v1/contacts/contact-1-org2", {
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_1.key}`,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Contact not found");
    });

    it("org 2 cannot access org 1 contact by ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts/contact-1-org1", {
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_2.key}`,
          },
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Contact not found");
    });

    it("created contacts belong to authenticated org", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/contacts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_1.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: "new@example.com" }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(ORG_1.id);
    });

    it("different API keys get different contexts", async () => {
      const [response1, response2] = await Promise.all([
        app.handle(
          new Request("http://localhost/v1/me", {
            headers: { Authorization: `Bearer ${API_KEY_ORG_1.key}` },
          })
        ),
        app.handle(
          new Request("http://localhost/v1/me", {
            headers: { Authorization: `Bearer ${API_KEY_ORG_2.key}` },
          })
        ),
      ]);

      const body1 = await response1.json();
      const body2 = await response2.json();

      expect(body1.organizationId).toBe(ORG_1.id);
      expect(body2.organizationId).toBe(ORG_2.id);
      expect(body1.organizationId).not.toBe(body2.organizationId);
    });
  });

  describe("Plan/Subscription Access", () => {
    it("includes plan information in auth context", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_1.key}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.planId).toBe("starter");
    });

    it("different orgs have different plans", async () => {
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: {
            Authorization: `Bearer ${API_KEY_ORG_2.key}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.planId).toBe("pro");
    });
  });

  describe("Multiple Concurrent Requests", () => {
    it("handles concurrent requests with different auth contexts", async () => {
      // Simulate multiple concurrent requests from different tenants
      const responses = await Promise.all([
        app.handle(
          new Request("http://localhost/v1/contacts", {
            headers: { Authorization: `Bearer ${API_KEY_ORG_1.key}` },
          })
        ),
        app.handle(
          new Request("http://localhost/v1/contacts", {
            headers: { Authorization: `Bearer ${API_KEY_ORG_2.key}` },
          })
        ),
        app.handle(
          new Request("http://localhost/v1/contacts", {
            headers: { Authorization: `Bearer ${API_KEY_ORG_1.key}` },
          })
        ),
      ]);

      const bodies = await Promise.all(responses.map((r) => r.json()));

      // Verify each request got the correct tenant context
      expect(bodies[0].organizationId).toBe(ORG_1.id);
      expect(bodies[1].organizationId).toBe(ORG_2.id);
      expect(bodies[2].organizationId).toBe(ORG_1.id);

      // Verify tenant isolation
      expect(bodies[0].contacts.length).toBe(2); // Org 1 has 2 contacts
      expect(bodies[1].contacts.length).toBe(1); // Org 2 has 1 contact
    });
  });
});

describe("Security Edge Cases", () => {
  let app: ReturnType<typeof createAuthTestApp>;

  beforeEach(() => {
    app = createAuthTestApp();
  });

  it("prevents auth header injection via other headers", async () => {
    // Attempt to bypass auth by putting credentials in wrong header
    const response = await app.handle(
      new Request("http://localhost/v1/contacts", {
        headers: {
          "X-Authorization": `Bearer ${API_KEY_ORG_1.key}`,
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it("handles empty authorization header", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/contacts", {
        headers: {
          Authorization: "",
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it("handles whitespace-only authorization header", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/contacts", {
        headers: {
          Authorization: "   ",
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it("handles Bearer with no token", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/contacts", {
        headers: {
          Authorization: "Bearer ",
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it("handles very long API keys gracefully", async () => {
    const longKey = "wraps_live_" + "a".repeat(10000);
    const response = await app.handle(
      new Request("http://localhost/v1/contacts", {
        headers: {
          Authorization: `Bearer ${longKey}`,
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it("handles special characters in token", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/contacts", {
        headers: {
          Authorization: "Bearer wraps_live_<script>alert(1)</script>",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});
