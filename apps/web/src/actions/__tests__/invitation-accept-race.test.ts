/**
 * acceptInvitation TOCTOU race condition test
 *
 * Verifies that concurrent calls to acceptInvitation cannot create
 * duplicate memberships. The function must atomically claim the invitation
 * (UPDATE WHERE status='pending') before inserting the member.
 */

import { db, invitation, member, organization, user } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { acceptInvitation } from "../invitations";

// Mock auth session
const mockGetSession = vi.fn();

vi.mock("@wraps/auth", () => ({
  auth: {
    api: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  },
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Test fixtures
const TEST_PREFIX = "accept-race";

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Race Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Race Test Org",
  slug: `${TEST_PREFIX}-org`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const ownerMember = {
  id: `${TEST_PREFIX}-member-owner`,
  organizationId: testOrg.id,
  userId: `${TEST_PREFIX}-owner-user`,
  role: "owner" as const,
  createdAt: new Date(),
};

const ownerUser = {
  id: `${TEST_PREFIX}-owner-user`,
  email: `${TEST_PREFIX}-owner@example.com`,
  name: "Owner User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testInvitation = {
  id: `${TEST_PREFIX}-invite-1`,
  organizationId: testOrg.id,
  email: testUser.email,
  role: "member",
  status: "pending",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  inviterId: ownerUser.id,
};

beforeAll(async () => {
  await db.insert(user).values(ownerUser).onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
  await db.insert(user).values(testUser).onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
  await db.insert(organization).values(testOrg).onConflictDoUpdate({ target: organization.id, set: { name: testOrg.name } });
  await db.insert(member).values(ownerMember).onConflictDoUpdate({ target: member.id, set: { role: ownerMember.role } });
});

beforeEach(async () => {
  // Clean up members (except owner) and reset invitation
  const members = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, testOrg.id),
        eq(member.userId, testUser.id)
      )
    );
  for (const m of members) {
    await db.delete(member).where(eq(member.id, m.id));
  }
  await db.delete(invitation).where(eq(invitation.id, testInvitation.id));
  await db.insert(invitation).values(testInvitation);

  mockGetSession.mockResolvedValue({
    user: { id: testUser.id, email: testUser.email, name: testUser.name },
  });
});

afterAll(async () => {
  await db.delete(invitation).where(eq(invitation.id, testInvitation.id));
  const members = await db.select({ id: member.id }).from(member).where(eq(member.organizationId, testOrg.id));
  for (const m of members) {
    await db.delete(member).where(eq(member.id, m.id));
  }
  await db.delete(organization).where(eq(organization.id, testOrg.id));
  await db.delete(user).where(eq(user.id, testUser.id));
  await db.delete(user).where(eq(user.id, ownerUser.id));
});

describe("acceptInvitation race condition", () => {
  it("second accept after invitation is already accepted returns failure", async () => {
    // First accept — should succeed
    const result1 = await acceptInvitation(testInvitation.id);
    expect(result1.success).toBe(true);

    // Simulate the race: another request accepted between the first's
    // SELECT and INSERT. Now try again with the same invitation.
    // The invitation is already "accepted" in the DB.
    // The function must check this atomically, not via SELECT-then-UPDATE.
    const result2 = await acceptInvitation(testInvitation.id);
    expect(result2.success).toBe(false);

    // Verify only one membership
    const memberships = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, testOrg.id),
          eq(member.userId, testUser.id)
        )
      );
    expect(memberships).toHaveLength(1);
  });

  it("accept after invitation claimed by race returns failure, not duplicate member", async () => {
    // Simulate the TOCTOU window: patch findFirst to return stale "pending" data
    // even though the invitation is already accepted in the DB.
    // This is exactly what happens in a concurrent race: both requests read "pending".
    await db
      .update(invitation)
      .set({ status: "accepted" })
      .where(eq(invitation.id, testInvitation.id));

    // Monkey-patch db.query.invitation.findFirst to return stale "pending" status
    const originalFindFirst = db.query.invitation.findFirst.bind(db.query.invitation);
    vi.spyOn(db.query.invitation, "findFirst").mockImplementationOnce(
      async (...args: any[]) => {
        const result = await (originalFindFirst as any)(...args);
        if (result?.id === testInvitation.id) {
          // Return stale data — pretend it's still "pending"
          return { ...result, status: "pending" };
        }
        return result;
      }
    );

    // With the old code: stale read says "pending", member check passes,
    // INSERT member succeeds, UPDATE invitation is a no-op → duplicate member
    // With the fix: atomic UPDATE WHERE status='pending' returns 0 rows → fail
    const result = await acceptInvitation(testInvitation.id);
    expect(result.success).toBe(false);

    vi.restoreAllMocks();
    // Re-setup the session mock that was cleared by restoreAllMocks
    mockGetSession.mockResolvedValue({
      user: { id: testUser.id, email: testUser.email, name: testUser.name },
    });

    // Verify no membership was created
    const memberships = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, testOrg.id),
          eq(member.userId, testUser.id)
        )
      );
    expect(memberships).toHaveLength(0);
  });
});
