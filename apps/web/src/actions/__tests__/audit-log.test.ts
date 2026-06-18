import { auditLog, db, eq, member, organization, user } from "@wraps/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { listAuditLogs } from "../audit-log";

// --- Mocks ---

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: userA.id, email: userA.email, name: userA.name },
        session: {
          id: "audit-log-test-session-a",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: userA.id,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "audit-log-test-token",
        },
      })),
    },
  },
}));

// --- Test fixtures ---

const userA = {
  id: "audit-test-user-a",
  email: "audit-user-a@example.com",
  name: "Audit User A",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const userB = {
  id: "audit-test-user-b",
  email: "audit-user-b@example.com",
  name: "Audit User B",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const orgA = {
  id: "audit-test-org-a",
  name: "Audit Org A",
  slug: "audit-org-a",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const orgB = {
  id: "audit-test-org-b",
  name: "Audit Org B",
  slug: "audit-org-b",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const memberA = {
  id: "audit-test-member-a",
  organizationId: orgA.id,
  userId: userA.id,
  role: "owner" as const,
  createdAt: new Date(),
};

// --- DB setup & teardown ---

beforeAll(async () => {
  await db
    .insert(user)
    .values(userA)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
  await db
    .insert(user)
    .values(userB)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });

  await db
    .insert(organization)
    .values(orgA)
    .onConflictDoUpdate({ target: organization.id, set: { name: orgA.name } });
  await db
    .insert(organization)
    .values(orgB)
    .onConflictDoUpdate({ target: organization.id, set: { name: orgB.name } });

  await db
    .insert(member)
    .values(memberA)
    .onConflictDoUpdate({ target: member.id, set: { role: memberA.role } });
});

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.organizationId, orgA.id));
  await db.delete(auditLog).where(eq(auditLog.organizationId, orgB.id));
  await db.delete(member).where(eq(member.id, memberA.id));
  await db.delete(organization).where(eq(organization.id, orgA.id));
  await db.delete(organization).where(eq(organization.id, orgB.id));
  await db.delete(user).where(eq(user.id, userA.id));
  await db.delete(user).where(eq(user.id, userB.id));
});

// --- listAuditLogs ---

describe("listAuditLogs", () => {
  it("returns events scoped to the caller's org only (not another org's events)", async () => {
    // Insert an event for orgB directly
    await db.insert(auditLog).values({
      organizationId: orgB.id,
      userId: userB.id,
      actorEmail: userB.email,
      action: "settings.updated",
      resource: "organization",
    });

    const result = await listAuditLogs(orgA.id);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // All returned events must belong to orgA
    for (const event of result.data) {
      expect(event.organizationId).toBe(orgA.id);
    }

    // orgB event must NOT appear
    const orgBEvent = result.data.find((e) => e.organizationId === orgB.id);
    expect(orgBEvent).toBeUndefined();
  });

  it("returns { success: false, error: 'Unauthorized' } for a user with no org membership", async () => {
    const { auth } = await import("@wraps/auth");
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: "no-such-user", email: "ghost@example.com", name: null },
      session: {
        id: "ghost-session",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "no-such-user",
        expiresAt: new Date(Date.now() + 86_400_000),
        token: "ghost-token",
      },
    } as any);

    const result = await listAuditLogs(orgA.id);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("You don't have access to this organization");
  });

  it("never returns events older than the org's plan retention window", async () => {
    // Insert an event created 100 days ago (exceeds all plan windows)
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await db.insert(auditLog).values({
      id: "audit-old-event-test",
      organizationId: orgA.id,
      userId: userA.id,
      actorEmail: userA.email,
      action: "api_key.created",
      resource: "api_key",
      createdAt: oldDate,
    });

    // Insert a recent event (2 days ago — well within the free plan 7-day window)
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db.insert(auditLog).values({
      id: "audit-recent-event-test",
      organizationId: orgA.id,
      userId: userA.id,
      actorEmail: userA.email,
      action: "settings.updated",
      resource: "organization",
      createdAt: recentDate,
    });

    // orgA is on free plan (7-day retention) — no paid subscription
    const result = await listAuditLogs(orgA.id);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Old event must be excluded
    const oldEvent = result.data.find((e) => e.id === "audit-old-event-test");
    expect(oldEvent).toBeUndefined();

    // Recent event must be included — confirms the query is filtering, not returning nothing
    const recentEvent = result.data.find(
      (e) => e.id === "audit-recent-event-test"
    );
    expect(recentEvent).toBeDefined();
  });

  it("filters results by action type when filter.action is provided", async () => {
    // Seed a sentinel row with a different action — must be excluded by the filter
    await db.insert(auditLog).values({
      id: "audit-filter-sentinel",
      organizationId: orgA.id,
      userId: userA.id,
      actorEmail: userA.email,
      action: "member.invited",
      resource: "member",
    });

    await db.insert(auditLog).values({
      organizationId: orgA.id,
      userId: userA.id,
      actorEmail: userA.email,
      action: "api_key.revoked",
      resource: "api_key",
      resourceId: "key-123",
    });

    const result = await listAuditLogs(orgA.id, {
      filter: { action: "api_key.revoked" },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.length).toBeGreaterThan(0);
    for (const event of result.data) {
      expect(event.action).toBe("api_key.revoked");
    }

    // The sentinel row with a different action must not appear
    const sentinel = result.data.find((e) => e.id === "audit-filter-sentinel");
    expect(sentinel).toBeUndefined();
  });

  it("returns Unauthorized for a user with the member role (not owner or admin)", async () => {
    const memberUser = {
      id: "audit-test-member-user",
      email: "member@example.com",
      name: "Member User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
      twoFactorEnabled: false,
      stripeCustomerId: null,
    };
    await db
      .insert(user)
      .values(memberUser)
      .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
    await db
      .insert(member)
      .values({
        id: "audit-test-member-role",
        organizationId: orgA.id,
        userId: memberUser.id,
        role: "member",
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    const { auth } = await import("@wraps/auth");
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: {
        id: memberUser.id,
        email: memberUser.email,
        name: memberUser.name,
      },
      session: {
        id: "member-session",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: memberUser.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        token: "member-token",
      },
    } as any);

    const result = await listAuditLogs(orgA.id);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("You don't have permission to perform this action");

    // Cleanup
    await db.delete(member).where(eq(member.id, "audit-test-member-role"));
    await db.delete(user).where(eq(user.id, memberUser.id));
  });
});
