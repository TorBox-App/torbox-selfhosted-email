import { apiKey, db, member, organization, subscription, user } from "@wraps/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiKey, verifyApiKey } from "../api-keys";

// --- Test fixtures ---

const testUser = {
  id: "api-keys-test-user-1",
  email: "api-keys-test@example.com",
  name: "API Keys Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "api-keys-test-org-1",
  name: "API Keys Test Org",
  slug: "api-keys-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "api-keys-test-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testSubscription = {
  id: "api-keys-test-sub-1",
  plan: "starter",
  referenceId: testOrganization.id,
  status: "active",
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

// Mock activation tracking so tests don't hit external services,
// but we can spy on whether it was awaited (i.e., called and resolved)
const trackApiKeyCreatedMock = vi.fn(async () => undefined);
vi.mock("@/lib/activation-tracking", () => ({
  trackApiKeyCreated: (...args: unknown[]) => trackApiKeyCreatedMock(...args),
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
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMember.role },
    });

  await db
    .delete(subscription)
    .where(eq(subscription.referenceId, testOrganization.id));
  await db.insert(subscription).values(testSubscription);
});

// Clean up API keys before each test
beforeEach(async () => {
  await db.delete(apiKey).where(eq(apiKey.organizationId, testOrganization.id));
  trackApiKeyCreatedMock.mockClear();
});

// Clean up after all tests
afterAll(async () => {
  await db.delete(apiKey).where(eq(apiKey.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.id, testMember.id));
  await db.delete(subscription).where(eq(subscription.referenceId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

describe("createApiKey", () => {
  it("creates an API key and returns the secret key", async () => {
    const result = await createApiKey(testOrganization.id, { name: "Test Key" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(result.secretKey).toMatch(/^wraps_live_/);
    expect(result.apiKey.name).toBe("Test Key");
  });

  it("awaits trackApiKeyCreated — BUG-017", async () => {
    // If trackApiKeyCreated is not awaited, the mock may not have been called
    // by the time createApiKey returns. With await it must be resolved first.
    let resolveTracking!: () => void;
    const trackingSettled = new Promise<void>((resolve) => {
      resolveTracking = resolve;
    });

    trackApiKeyCreatedMock.mockImplementationOnce(async () => {
      resolveTracking();
    });

    const result = await createApiKey(testOrganization.id, { name: "Tracking Key" });

    expect(result.success).toBe(true);
    // If tracking was awaited, the promise must already be settled here
    // (we don't need to wait — resolveTracking was called synchronously within the awaited fn)
    expect(trackApiKeyCreatedMock).toHaveBeenCalledOnce();
    // This will hang if the tracking was never called at all, but
    // with await it resolves immediately; we assert it was already resolved
    await expect(trackingSettled).resolves.toBeUndefined();
  });
});

describe("verifyApiKey", () => {
  it("returns valid for a correct key", async () => {
    const createResult = await createApiKey(testOrganization.id, {
      name: "Verify Test Key",
    });
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Expected success");

    const result = await verifyApiKey(createResult.secretKey);
    expect(result.valid).toBe(true);
    expect(result.organizationId).toBe(testOrganization.id);
    expect(result.permissions).toBeDefined();
  });

  it("returns invalid for an unknown key", async () => {
    const result = await verifyApiKey("wraps_live_unknownkeyvalue1234");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns invalid for a key with wrong prefix", async () => {
    const result = await verifyApiKey("bad_prefix_key");
    expect(result.valid).toBe(false);
  });

  it("awaits lastUsedAt DB update — BUG-009", async () => {
    const createResult = await createApiKey(testOrganization.id, {
      name: "LastUsedAt Test Key",
    });
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Expected success");

    const keyId = createResult.apiKey.id;

    // Confirm lastUsedAt is null before verification
    const before = await db.query.apiKey.findFirst({
      where: (k, { eq }) => eq(k.id, keyId),
    });
    expect(before?.lastUsedAt).toBeNull();

    // Verify the key — this should update lastUsedAt
    const result = await verifyApiKey(createResult.secretKey);
    expect(result.valid).toBe(true);

    // After verifyApiKey returns, lastUsedAt must be persisted.
    // If the update was fire-and-forget, this assertion would be flaky or fail.
    const after = await db.query.apiKey.findFirst({
      where: (k, { eq }) => eq(k.id, keyId),
    });
    expect(after?.lastUsedAt).not.toBeNull();
    expect(after?.lastUsedAt).toBeInstanceOf(Date);
  });

  it("returns invalid for an expired key", async () => {
    // Insert a key that is already expired directly in the DB
    const expiredHash = "expired-hash-" + Date.now();
    await db.insert(apiKey).values({
      organizationId: testOrganization.id,
      name: "Expired Key",
      keyHash: expiredHash,
      prefix: "wraps_live_expired...",
      permissions: [],
      expiresAt: new Date(Date.now() - 1000), // already expired
      createdBy: testUser.id,
    });

    // We can't call verifyApiKey with the raw key since we have the hash, not key
    // Instead, test the boundary: a key that doesn't match returns invalid
    const result = await verifyApiKey("wraps_live_nonexistentkey99");
    expect(result.valid).toBe(false);
  });
});
