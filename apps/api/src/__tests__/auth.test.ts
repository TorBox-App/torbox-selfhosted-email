/**
 * Authentication & Authorization Tests
 *
 * Integration tests for the real auth middleware against a real database.
 * Tests API key auth, session auth, tenant isolation, and edge cases.
 */

import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  apiKey,
  db,
  eq,
  member,
  organization,
  session,
  subscription,
  user,
} from "@wraps/db";
import { inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createAuthenticatedRoutes } from "../middleware/auth";

const TEST_PREFIX = "auth-test";

// --- Test data ---

const testUser1 = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}-1@example.com`,
  name: "Auth Test User 1",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testUser2 = {
  id: `${TEST_PREFIX}-user-2`,
  email: `${TEST_PREFIX}-2@example.com`,
  name: "Auth Test User 2",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg1 = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Auth Test Org 1",
  slug: `${TEST_PREFIX}-org-1`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testOrg2 = {
  id: `${TEST_PREFIX}-org-2`,
  name: "Auth Test Org 2",
  slug: `${TEST_PREFIX}-org-2`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

// Pre-compute API key hashes
const RAW_KEY_ORG1 = "wraps_live_authtest_org1_key";
const RAW_KEY_ORG2 = "wraps_live_authtest_org2_key";
const RAW_KEY_EXPIRED = "wraps_live_authtest_expired_key";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

const testApiKeyOrg1 = {
  id: `${TEST_PREFIX}-apikey-org1`,
  organizationId: testOrg1.id,
  name: "Test Key Org 1",
  keyHash: hashKey(RAW_KEY_ORG1),
  prefix: "wraps_live_auth",
  permissions: [],
  expiresAt: null,
  createdBy: testUser1.id,
  createdAt: new Date(),
};

const testApiKeyOrg2 = {
  id: `${TEST_PREFIX}-apikey-org2`,
  organizationId: testOrg2.id,
  name: "Test Key Org 2",
  keyHash: hashKey(RAW_KEY_ORG2),
  prefix: "wraps_live_auth",
  permissions: [],
  expiresAt: null,
  createdBy: testUser2.id,
  createdAt: new Date(),
};

const testApiKeyExpired = {
  id: `${TEST_PREFIX}-apikey-expired`,
  organizationId: testOrg1.id,
  name: "Expired Key",
  keyHash: hashKey(RAW_KEY_EXPIRED),
  prefix: "wraps_live_auth",
  permissions: [],
  expiresAt: new Date("2020-01-01"),
  createdBy: testUser1.id,
  createdAt: new Date(),
};

const SESSION_TOKEN_ORG1 = `${TEST_PREFIX}-session-token-1`;

const testSessionOrg1 = {
  id: `${TEST_PREFIX}-session-1`,
  token: SESSION_TOKEN_ORG1,
  userId: testUser1.id,
  activeOrganizationId: testOrg1.id,
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ipAddress: null,
  userAgent: null,
};

const SESSION_TOKEN_EXPIRED = `${TEST_PREFIX}-session-token-expired`;

const testSessionExpired = {
  id: `${TEST_PREFIX}-session-expired`,
  token: SESSION_TOKEN_EXPIRED,
  userId: testUser1.id,
  activeOrganizationId: testOrg1.id,
  expiresAt: new Date("2020-01-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
  ipAddress: null,
  userAgent: null,
};

const testSubscriptionOrg1 = {
  id: `${TEST_PREFIX}-sub-1`,
  plan: "starter",
  referenceId: testOrg1.id,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testSubscriptionOrg2 = {
  id: `${TEST_PREFIX}-sub-2`,
  plan: "growth",
  referenceId: testOrg2.id,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// --- Org 3: multi-subscription-row scenarios (stale canceled row alongside active) ---

const testUser3 = {
  id: `${TEST_PREFIX}-user-3`,
  email: `${TEST_PREFIX}-3@example.com`,
  name: "Auth Test User 3",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg3 = {
  id: `${TEST_PREFIX}-org-3`,
  name: "Auth Test Org 3",
  slug: `${TEST_PREFIX}-org-3`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const RAW_KEY_ORG3 = "wraps_live_authtest_org3_key";

const testApiKeyOrg3 = {
  id: `${TEST_PREFIX}-apikey-org3`,
  organizationId: testOrg3.id,
  name: "Test Key Org 3",
  keyHash: hashKey(RAW_KEY_ORG3),
  prefix: "wraps_live_auth",
  permissions: [],
  expiresAt: null,
  createdBy: testUser3.id,
  createdAt: new Date(),
};

const SESSION_TOKEN_ORG3 = `${TEST_PREFIX}-session-token-3`;

const testSessionOrg3 = {
  id: `${TEST_PREFIX}-session-3`,
  token: SESSION_TOKEN_ORG3,
  userId: testUser3.id,
  activeOrganizationId: testOrg3.id,
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ipAddress: null,
  userAgent: null,
};

// Org 3 has TWO subscription rows: a stale canceled one and a live active one.
// A canceled row must never shadow the active plan (the bug this test guards against).
const testSubscriptionOrg3Canceled = {
  id: `${TEST_PREFIX}-sub-3-canceled`,
  plan: "scale",
  referenceId: testOrg3.id,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: "canceled",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testSubscriptionOrg3Active = {
  id: `${TEST_PREFIX}-sub-3-active`,
  plan: "growth",
  referenceId: testOrg3.id,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// --- Org 4: no subscription row at all (regression — must remain free/null) ---

const testUser4 = {
  id: `${TEST_PREFIX}-user-4`,
  email: `${TEST_PREFIX}-4@example.com`,
  name: "Auth Test User 4",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg4 = {
  id: `${TEST_PREFIX}-org-4`,
  name: "Auth Test Org 4",
  slug: `${TEST_PREFIX}-org-4`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const RAW_KEY_ORG4 = "wraps_live_authtest_org4_key";

const testApiKeyOrg4 = {
  id: `${TEST_PREFIX}-apikey-org4`,
  organizationId: testOrg4.id,
  name: "Test Key Org 4 (no subscription)",
  keyHash: hashKey(RAW_KEY_ORG4),
  prefix: "wraps_live_auth",
  permissions: [],
  expiresAt: null,
  createdBy: testUser4.id,
  createdAt: new Date(),
};

// --- Org 5: only a canceled subscription row (regression — must remain free/null) ---

const testUser5 = {
  id: `${TEST_PREFIX}-user-5`,
  email: `${TEST_PREFIX}-5@example.com`,
  name: "Auth Test User 5",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg5 = {
  id: `${TEST_PREFIX}-org-5`,
  name: "Auth Test Org 5",
  slug: `${TEST_PREFIX}-org-5`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const RAW_KEY_ORG5 = "wraps_live_authtest_org5_key";

const testApiKeyOrg5 = {
  id: `${TEST_PREFIX}-apikey-org5`,
  organizationId: testOrg5.id,
  name: "Test Key Org 5 (only canceled sub)",
  keyHash: hashKey(RAW_KEY_ORG5),
  prefix: "wraps_live_auth",
  permissions: [],
  expiresAt: null,
  createdBy: testUser5.id,
  createdAt: new Date(),
};

const testSubscriptionOrg5Canceled = {
  id: `${TEST_PREFIX}-sub-5-canceled`,
  plan: "starter",
  referenceId: testOrg5.id,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: "canceled",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// --- Org 6: only a trialing subscription row (regression — trialing counts) ---

const testUser6 = {
  id: `${TEST_PREFIX}-user-6`,
  email: `${TEST_PREFIX}-6@example.com`,
  name: "Auth Test User 6",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg6 = {
  id: `${TEST_PREFIX}-org-6`,
  name: "Auth Test Org 6",
  slug: `${TEST_PREFIX}-org-6`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const RAW_KEY_ORG6 = "wraps_live_authtest_org6_key";

const testApiKeyOrg6 = {
  id: `${TEST_PREFIX}-apikey-org6`,
  organizationId: testOrg6.id,
  name: "Test Key Org 6 (trialing)",
  keyHash: hashKey(RAW_KEY_ORG6),
  prefix: "wraps_live_auth",
  permissions: [],
  expiresAt: null,
  createdBy: testUser6.id,
  createdAt: new Date(),
};

const testSubscriptionOrg6Trialing = {
  id: `${TEST_PREFIX}-sub-6-trialing`,
  plan: "starter",
  referenceId: testOrg6.id,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: "trialing",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// --- Test app using the real auth middleware ---

function createTestApp() {
  return createAuthenticatedRoutes("/v1").get("/me", ({ auth }) => ({
    organizationId: auth!.organizationId,
    userId: auth!.userId,
    planId: auth!.planId,
    apiKeyId: auth!.apiKeyId,
  }));
}

// --- License key isolation ---
// WRAPS_LICENSE_KEY may be set in the shell environment (self-hosted deployments).
// Stub it to empty before each test so plan lookups come from the DB, not the license override.
// The "License Key Override" describe re-stubs it for its own tests.
beforeEach(() => vi.stubEnv("WRAPS_LICENSE_KEY", ""));
afterEach(() => vi.unstubAllEnvs());

// --- DB setup/teardown ---

beforeAll(async () => {
  // Insert users
  await db
    .insert(user)
    .values([testUser1, testUser2, testUser3, testUser4, testUser5, testUser6])
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });

  // Insert orgs
  await db
    .insert(organization)
    .values([testOrg1, testOrg2, testOrg3, testOrg4, testOrg5, testOrg6])
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: testOrg1.name },
    });

  // Insert memberships
  await db
    .insert(member)
    .values([
      {
        id: `${TEST_PREFIX}-member-1`,
        organizationId: testOrg1.id,
        userId: testUser1.id,
        role: "owner",
        createdAt: new Date(),
      },
      {
        id: `${TEST_PREFIX}-member-2`,
        organizationId: testOrg2.id,
        userId: testUser2.id,
        role: "owner",
        createdAt: new Date(),
      },
      {
        id: `${TEST_PREFIX}-member-3`,
        organizationId: testOrg3.id,
        userId: testUser3.id,
        role: "owner",
        createdAt: new Date(),
      },
    ])
    .onConflictDoUpdate({ target: member.id, set: { role: "owner" } });

  // Insert subscriptions — upsert plan+status so stale rows from crashed runs don't persist wrong data
  for (const sub of [
    testSubscriptionOrg1,
    testSubscriptionOrg2,
    testSubscriptionOrg3Canceled,
    testSubscriptionOrg3Active,
    testSubscriptionOrg5Canceled,
    testSubscriptionOrg6Trialing,
  ]) {
    await db
      .insert(subscription)
      .values(sub)
      .onConflictDoUpdate({
        target: subscription.id,
        set: { plan: sub.plan, status: sub.status, updatedAt: new Date() },
      });
  }

  // Insert API keys
  await db
    .insert(apiKey)
    .values([
      testApiKeyOrg1,
      testApiKeyOrg2,
      testApiKeyExpired,
      testApiKeyOrg3,
      testApiKeyOrg4,
      testApiKeyOrg5,
      testApiKeyOrg6,
    ])
    .onConflictDoUpdate({
      target: apiKey.id,
      set: { createdAt: new Date() },
    });

  // Insert sessions
  await db
    .insert(session)
    .values([testSessionOrg1, testSessionExpired, testSessionOrg3])
    .onConflictDoUpdate({
      target: session.id,
      set: { updatedAt: new Date() },
    });
});

afterAll(async () => {
  const userIds = [
    testUser1.id,
    testUser2.id,
    testUser3.id,
    testUser4.id,
    testUser5.id,
    testUser6.id,
  ];
  const orgIds = [
    testOrg1.id,
    testOrg2.id,
    testOrg3.id,
    testOrg4.id,
    testOrg5.id,
    testOrg6.id,
  ];
  await db.delete(session).where(inArray(session.userId, userIds));
  await db.delete(apiKey).where(inArray(apiKey.organizationId, orgIds));
  await db.delete(member).where(inArray(member.organizationId, orgIds));
  await db
    .delete(subscription)
    .where(inArray(subscription.referenceId, orgIds));
  await db.delete(organization).where(inArray(organization.id, orgIds));
  await db.delete(user).where(inArray(user.id, userIds));
});

// --- Tests ---

describe("Authentication", () => {
  describe("API Key Authentication", () => {
    it("authenticates with valid API key", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG1}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg1.id);
      expect(body.apiKeyId).toBe(testApiKeyOrg1.id);
      expect(body.userId).toBe(testUser1.id);
    });

    it("returns plan from subscription", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG1}` },
        })
      );

      const body = await response.json();
      expect(body.planId).toBe("starter");
    });

    it("different org gets different plan", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG2}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg2.id);
      expect(body.planId).toBe("growth");
    });

    it("rejects invalid API key", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: "Bearer wraps_live_doesnotexist" },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects expired API key", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_EXPIRED}` },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("handles API key without Bearer prefix", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: RAW_KEY_ORG1 },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg1.id);
    });

    it("updates lastUsedAt on successful auth", async () => {
      const app = createTestApp();
      const before = new Date();

      await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG1}` },
        })
      );

      const [updatedKey] = await db
        .select({ lastUsedAt: apiKey.lastUsedAt })
        .from(apiKey)
        .where(eq(apiKey.id, testApiKeyOrg1.id))
        .limit(1);

      expect(updatedKey.lastUsedAt).toBeInstanceOf(Date);
      expect(updatedKey.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000
      );
    });
  });

  describe("Session Authentication", () => {
    it("authenticates with valid session token", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${SESSION_TOKEN_ORG1}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg1.id);
      expect(body.userId).toBe(testUser1.id);
      expect(body.apiKeyId).toBeNull();
    });

    it("rejects invalid session token", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: "Bearer invalid-session-token" },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      // Uniform error — no reason leak (prevents session enumeration)
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects expired session", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${SESSION_TOKEN_EXPIRED}` },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      // Uniform error — no reason leak (prevents session state probing)
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects session for non-member org via X-Organization-Id header", async () => {
      const app = createTestApp();
      // User 1 trying to access Org 2 (they're not a member)
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: {
            Authorization: `Bearer ${SESSION_TOKEN_ORG1}`,
            "X-Organization-Id": testOrg2.id,
          },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      // Uniform error — no reason leak (prevents org membership enumeration)
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("No Auth", () => {
    it("rejects requests without auth header", async () => {
      const app = createTestApp();
      const response = await app.handle(new Request("http://localhost/v1/me"));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("Concurrent Requests", () => {
    it("isolates auth context across concurrent requests", async () => {
      const app = createTestApp();

      const [r1, r2, r3] = await Promise.all([
        app.handle(
          new Request("http://localhost/v1/me", {
            headers: { Authorization: `Bearer ${RAW_KEY_ORG1}` },
          })
        ),
        app.handle(
          new Request("http://localhost/v1/me", {
            headers: { Authorization: `Bearer ${RAW_KEY_ORG2}` },
          })
        ),
        app.handle(
          new Request("http://localhost/v1/me", {
            headers: { Authorization: `Bearer ${SESSION_TOKEN_ORG1}` },
          })
        ),
      ]);

      const [b1, b2, b3] = await Promise.all([r1.json(), r2.json(), r3.json()]);

      expect(b1.organizationId).toBe(testOrg1.id);
      expect(b2.organizationId).toBe(testOrg2.id);
      expect(b3.organizationId).toBe(testOrg1.id);

      // API key vs session auth
      expect(b1.apiKeyId).toBe(testApiKeyOrg1.id);
      expect(b3.apiKeyId).toBeNull();
    });
  });

  describe("Security Edge Cases", () => {
    it("rejects empty authorization header", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: "" },
        })
      );

      expect(response.status).toBe(401);
    });

    it("rejects Bearer with no token", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: "Bearer " },
        })
      );

      expect(response.status).toBe(401);
    });

    it("rejects non-wraps_ prefix tokens as invalid sessions", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: "Bearer some_random_token" },
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      // Uniform error — no reason leak
      expect(body.error).toBe("Unauthorized");
    });

    it("handles very long API keys gracefully", async () => {
      const app = createTestApp();
      const longKey = `wraps_live_${"a".repeat(10_000)}`;
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${longKey}` },
        })
      );

      expect(response.status).toBe(401);
    });

    it("prevents auth header injection via wrong header name", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { "X-Authorization": `Bearer ${RAW_KEY_ORG1}` },
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe("Subscription Row Scoping", () => {
    it("API key path: a stale canceled subscription row never shadows the active one", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG3}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      // Org 3 has both a "canceled" (scale) row and an "active" (growth) row.
      // The join must be scoped to active/trialing so the canceled row can't be selected.
      expect(body.planId).toBe("growth");
      expect(body.planId).not.toBe("scale");
    });

    it("session path: a stale canceled subscription row never shadows the active one", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${SESSION_TOKEN_ORG3}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg3.id);
      expect(body.planId).toBe("growth");
      expect(body.planId).not.toBe("scale");
    });

    it("no subscription row → planId is null (free tier, regression)", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG4}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg4.id);
      expect(body.planId).toBeNull();
    });

    it("only a canceled subscription row → planId is null (regression)", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG5}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg5.id);
      expect(body.planId).toBeNull();
    });

    it("only a trialing subscription row → planId is that plan (regression)", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG6}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.organizationId).toBe(testOrg6.id);
      expect(body.planId).toBe(testSubscriptionOrg6Trialing.plan);
    });
  });

  describe("License Key Override", () => {
    const { privateKey: LIC_PRIV_PEM, publicKey: LIC_PUB_PEM } =
      generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      }) as { privateKey: string; publicKey: string };

    beforeEach(() => vi.stubEnv("WRAPS_LICENSE_PUBLIC_KEY_PEM", LIC_PUB_PEM));
    afterEach(() => vi.unstubAllEnvs());

    function makeScaleKey(): string {
      const payload = "v1.scale.2099-12-31";
      return `${payload}.${sign(null, Buffer.from(payload), LIC_PRIV_PEM).toString("hex")}`;
    }

    it("when WRAPS_LICENSE_KEY is a valid scale key, planId overrides Stripe subscription", async () => {
      vi.stubEnv("WRAPS_LICENSE_KEY", makeScaleKey());
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG1}` }, // ORG1 has "starter" Stripe plan
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.planId).toBe("scale");
    });

    it("when WRAPS_LICENSE_KEY is tampered, planId falls back to Stripe subscription", async () => {
      const tampered = `${makeScaleKey().slice(0, -4)}dead`;
      vi.stubEnv("WRAPS_LICENSE_KEY", tampered);
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG1}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.planId).toBe("starter"); // tampered key rejected, falls back to ORG1 Stripe plan
    });

    it("when WRAPS_LICENSE_KEY is not set, planId comes from Stripe subscription", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/v1/me", {
          headers: { Authorization: `Bearer ${RAW_KEY_ORG1}` },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.planId).toBe("starter"); // Stripe subscription plan for ORG1
    });
  });
});
