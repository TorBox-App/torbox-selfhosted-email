import {
  apiKey,
  auditLog,
  db,
  member,
  organization,
  subscription,
  user,
} from "@wraps/db";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createApiKey, deleteApiKey } from "../api-keys";

// --- Test fixtures ---

const testUser = {
  id: "api-keys-audit-user-1",
  email: "api-keys-audit@example.com",
  name: "API Keys Audit User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "api-keys-audit-org-1",
  name: "API Keys Audit Org",
  slug: "api-keys-audit-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "api-keys-audit-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testSubscription = {
  id: "api-keys-audit-sub-1",
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
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        session: {
          id: "api-keys-audit-session-1",
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

// Mock activation tracking
vi.mock("@/lib/activation-tracking", () => ({
  trackApiKeyCreated: vi.fn(async () => {}),
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

// Clean up api keys and audit log rows before each test
beforeEach(async () => {
  await db.delete(apiKey).where(eq(apiKey.organizationId, testOrganization.id));
  await db
    .delete(auditLog)
    .where(eq(auditLog.organizationId, testOrganization.id));
});

// Clean up after all tests
afterAll(async () => {
  await db
    .delete(auditLog)
    .where(eq(auditLog.organizationId, testOrganization.id));
  await db.delete(apiKey).where(eq(apiKey.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.id, testMember.id));
  await db
    .delete(subscription)
    .where(eq(subscription.referenceId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

describe("createApiKey audit logging", () => {
  it("writes an api_key.created audit log row after successful key creation", async () => {
    const result = await createApiKey(testOrganization.id, {
      name: "Audit Test Key",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    const [row] = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.organizationId, testOrganization.id),
          eq(auditLog.action, "api_key.created")
        )
      )
      .limit(1);

    expect(row).toBeDefined();
    expect(row.action).toBe("api_key.created");
    expect(row.resource).toBe("api_key");
    expect(row.resourceId).toBe(result.apiKey.id);
    expect(row.userId).toBe(testUser.id);
    expect(row.actorEmail).toBe(testUser.email);
    expect(row.metadata).toMatchObject({
      name: "Audit Test Key",
      type: "live",
    });
  });
});

describe("deleteApiKey audit logging", () => {
  it("writes an api_key.revoked audit log row after successful deletion", async () => {
    // First create a key to delete
    const created = await createApiKey(testOrganization.id, {
      name: "Key To Revoke",
    });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error("Expected success");

    // Clear audit log rows from creation so we test only the deletion
    await db
      .delete(auditLog)
      .where(eq(auditLog.organizationId, testOrganization.id));

    const deleteResult = await deleteApiKey(
      created.apiKey.id,
      testOrganization.id
    );

    expect(deleteResult.success).toBe(true);

    const [row] = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.organizationId, testOrganization.id),
          eq(auditLog.action, "api_key.revoked")
        )
      )
      .limit(1);

    expect(row).toBeDefined();
    expect(row.action).toBe("api_key.revoked");
    expect(row.resource).toBe("api_key");
    expect(row.resourceId).toBe(created.apiKey.id);
    expect(row.userId).toBe(testUser.id);
    expect(row.actorEmail).toBe(testUser.email);
    expect(row.metadata).toMatchObject({ name: "Key To Revoke" });
  });
});
