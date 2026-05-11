/**
 * Auth Login Audit Log Tests — Chunk 8
 *
 * Verifies that writeLoginAuditLogs inserts correctly-shaped audit_log rows
 * for every org the user belongs to. Tests the extracted function directly
 * since the session.create.after hook is too tightly coupled to better-auth
 * to unit test in isolation.
 */

import { auditLog, db, member, organization, user } from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeLoginAuditLogs } from "../index";

// --- Test fixtures ---

const testUser = {
  id: "audit-v2-auth-user-a",
  email: "audit-v2-auth-user-a@example.com",
  name: "Audit V2 Auth User A",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const orgA = {
  id: "audit-v2-auth-org-a",
  name: "Audit V2 Auth Org A",
  slug: "audit-v2-auth-org-a",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const orgB = {
  id: "audit-v2-auth-org-b",
  name: "Audit V2 Auth Org B",
  slug: "audit-v2-auth-org-b",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const memberA = {
  id: "audit-v2-auth-member-a",
  organizationId: orgA.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const memberB = {
  id: "audit-v2-auth-member-b",
  organizationId: orgB.id,
  userId: testUser.id,
  role: "member" as const,
  createdAt: new Date(),
};

const TEST_SESSION_ID = "audit-v2-auth-session-1";

// --- DB setup & teardown ---

beforeAll(async () => {
  await db
    .insert(user)
    .values(testUser)
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

  await db
    .insert(member)
    .values(memberB)
    .onConflictDoUpdate({ target: member.id, set: { role: memberB.role } });
});

afterAll(async () => {
  await db
    .delete(auditLog)
    .where(
      and(eq(auditLog.action, "auth.login"), eq(auditLog.userId, testUser.id))
    );
  await db.delete(member).where(eq(member.id, memberA.id));
  await db.delete(member).where(eq(member.id, memberB.id));
  await db.delete(organization).where(eq(organization.id, orgA.id));
  await db.delete(organization).where(eq(organization.id, orgB.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

// --- Tests ---

describe("writeLoginAuditLogs — writes auth.login audit rows for each org", () => {
  it("inserts one auth.login row per org membership with correct fields", async () => {
    await writeLoginAuditLogs(testUser.id, TEST_SESSION_ID, testUser.email);

    // Verify row for org A
    const rowsA = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.organizationId, orgA.id),
          eq(auditLog.action, "auth.login"),
          eq(auditLog.userId, testUser.id)
        )
      );

    expect(rowsA.length).toBeGreaterThan(0);
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
    const rowA = rowsA.at(-1)!;
    expect(rowA.organizationId).toBe(orgA.id);
    expect(rowA.userId).toBe(testUser.id);
    expect(rowA.actorEmail).toBe(testUser.email);
    expect(rowA.action).toBe("auth.login");
    expect(rowA.resource).toBe("session");
    expect(rowA.resourceId).toBe(TEST_SESSION_ID);
    expect(rowA.metadata).toMatchObject({ userId: testUser.id });
    expect(rowA.ipAddress).toBeNull();
    expect(rowA.userAgent).toBeNull();

    // Verify row for org B
    const rowsB = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.organizationId, orgB.id),
          eq(auditLog.action, "auth.login"),
          eq(auditLog.userId, testUser.id)
        )
      );

    expect(rowsB.length).toBeGreaterThan(0);
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
    const rowB = rowsB.at(-1)!;
    expect(rowB.organizationId).toBe(orgB.id);
    expect(rowB.userId).toBe(testUser.id);
    expect(rowB.actorEmail).toBe(testUser.email);
    expect(rowB.action).toBe("auth.login");
    expect(rowB.resource).toBe("session");
    expect(rowB.resourceId).toBe(TEST_SESSION_ID);
    expect(rowB.metadata).toMatchObject({ userId: testUser.id });
  });

  it("writes zero rows when user has no org memberships", async () => {
    const noOrgUser = {
      id: "audit-v2-auth-noorg-user",
      email: "audit-v2-auth-noorg@example.com",
      name: "No Org User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
      twoFactorEnabled: false,
      stripeCustomerId: null,
    };

    await db
      .insert(user)
      .values(noOrgUser)
      .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });

    try {
      await writeLoginAuditLogs(
        noOrgUser.id,
        "audit-v2-auth-noorg-session",
        noOrgUser.email
      );

      const rows = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.action, "auth.login"),
            eq(auditLog.userId, noOrgUser.id)
          )
        );

      expect(rows.length).toBe(0);
    } finally {
      await db.delete(user).where(eq(user.id, noOrgUser.id));
    }
  });
});
