import { db, member, organization, subscription, user } from "@wraps/db";
import { eq } from "drizzle-orm";
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
import {
  createFreeSubscription,
  getOrganizationSubscription,
} from "../subscriptions";

// ── Static test fixtures ──────────────────────────────────────────────────────

const testUser = {
  id: "test-sub-user-1",
  email: "sub-owner@example.com",
  name: "Sub Owner",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const otherUser = {
  id: "test-sub-other-1",
  email: "sub-other@example.com",
  name: "Sub Other",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const memberUser = {
  id: "test-sub-member-user-1",
  email: "sub-member@example.com",
  name: "Sub Member",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: "test-sub-org-1",
  name: "Sub Test Org",
  slug: "test-sub-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const ownerMember = {
  id: "test-sub-owner-member-1",
  organizationId: testOrg.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

// member role has no billing permissions — used to test perm denial
const regularMember = {
  id: "test-sub-regular-member-1",
  organizationId: testOrg.id,
  userId: memberUser.id,
  role: "member" as const,
  createdAt: new Date(),
};

// ── Auth mock ─────────────────────────────────────────────────────────────────

let mockUserId: string | null = testUser.id;

vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => {
        if (!mockUserId) return null;
        const emails: Record<string, string> = {
          [testUser.id]: testUser.email,
          [otherUser.id]: otherUser.email,
          [memberUser.id]: memberUser.email,
        };
        return {
          user: {
            id: mockUserId,
            email: emails[mockUserId] ?? "unknown@example.com",
          },
        };
      }),
    },
  },
}));

// ── DB setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await db
    .insert(user)
    .values(testUser)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
  await db
    .insert(user)
    .values(otherUser)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
  await db
    .insert(user)
    .values(memberUser)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
  await db
    .insert(organization)
    .values(testOrg)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: testOrg.name },
    });
  await db
    .insert(member)
    .values(ownerMember)
    .onConflictDoUpdate({ target: member.id, set: { role: ownerMember.role } });
  await db
    .insert(member)
    .values(regularMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: regularMember.role },
    });
});

beforeEach(() => {
  mockUserId = testUser.id;
});

afterEach(async () => {
  // Remove any subscriptions created during the test
  await db.delete(subscription).where(eq(subscription.referenceId, testOrg.id));
});

afterAll(async () => {
  await db.delete(member).where(eq(member.id, regularMember.id));
  await db.delete(member).where(eq(member.id, ownerMember.id));
  await db.delete(organization).where(eq(organization.id, testOrg.id));
  await db.delete(user).where(eq(user.id, testUser.id));
  await db.delete(user).where(eq(user.id, otherUser.id));
  await db.delete(user).where(eq(user.id, memberUser.id));
});

// ── getOrganizationSubscription ───────────────────────────────────────────────

describe("getOrganizationSubscription", () => {
  it("returns error when not authenticated", async () => {
    mockUserId = null;
    const result = await getOrganizationSubscription(testOrg.id);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("You don't have access to this organization");
  });

  it("returns error when user is not a member of the org (IDOR)", async () => {
    mockUserId = otherUser.id;
    const result = await getOrganizationSubscription(testOrg.id);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("You don't have access to this organization");
  });

  it("returns error when member role lacks billing read permission", async () => {
    mockUserId = memberUser.id;
    const result = await getOrganizationSubscription(testOrg.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("permission");
  });

  it("returns null subscription when org has no subscription", async () => {
    const result = await getOrganizationSubscription(testOrg.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.subscription).toBeNull();
  });

  it("returns subscription data when one exists", async () => {
    await db.insert(subscription).values({
      id: "test-sub-existing-1",
      plan: "growth",
      referenceId: testOrg.id,
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      seats: 5,
      annual: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getOrganizationSubscription(testOrg.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.subscription).not.toBeNull();
      expect(result.subscription?.plan).toBe("growth");
      expect(result.subscription?.status).toBe("active");
      expect(result.subscription?.id).toBe("test-sub-existing-1");
    }
  });
});

// ── createFreeSubscription ────────────────────────────────────────────────────

describe("createFreeSubscription", () => {
  it("returns error when not authenticated", async () => {
    mockUserId = null;
    const result = await createFreeSubscription(testOrg.id);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("You don't have access to this organization");
  });

  it("returns error when user is not a member of the org (IDOR)", async () => {
    mockUserId = otherUser.id;
    const result = await createFreeSubscription(testOrg.id);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("You don't have access to this organization");
  });

  it("blocks member role from creating a free subscription (billing:write required)", async () => {
    mockUserId = memberUser.id;
    const result = await createFreeSubscription(testOrg.id);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("permission");
  });

  it("creates a free subscription and returns it", async () => {
    const result = await createFreeSubscription(testOrg.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.subscription.plan).toBe("free");
      expect(result.subscription.status).toBe("active");
      expect(result.subscription.id).toBeDefined();
    }
  });

  it("returns existing subscription without creating a duplicate when one already exists", async () => {
    const first = await createFreeSubscription(testOrg.id);
    expect(first.success).toBe(true);

    const second = await createFreeSubscription(testOrg.id);
    expect(second.success).toBe(true);

    if (first.success && second.success) {
      expect(second.subscription.id).toBe(first.subscription.id);
    }

    // Confirm only one row was inserted
    const rows = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, testOrg.id));
    expect(rows).toHaveLength(1);
  });
});
