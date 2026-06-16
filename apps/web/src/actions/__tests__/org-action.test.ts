/**
 * Behavioral tests for the orgAction wrapper.
 *
 * Tests use a real Neon DB (same pattern as topics.test.ts) and mock only
 * next/headers, next/cache, and @wraps/auth.
 */

import {
  auditLog,
  db,
  member,
  organization,
  subscription,
  topic,
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
import { orgAction } from "../shared/org-action";

// Unique prefix so shared DB doesn't collide with other test files
const PREFIX = "test-orgaction";

const testUser = {
  id: `${PREFIX}-user-1`,
  email: `${PREFIX}@example.com`,
  name: "OrgAction Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const billingUser = {
  id: `${PREFIX}-billing-user`,
  email: `${PREFIX}-billing@example.com`,
  name: "OrgAction Billing User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${PREFIX}-org-1`,
  name: "OrgAction Test Org",
  slug: `${PREFIX}-org`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const ownerMember = {
  id: `${PREFIX}-owner-member`,
  organizationId: testOrg.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const billingMember = {
  id: `${PREFIX}-billing-member`,
  organizationId: testOrg.id,
  userId: billingUser.id,
  role: "billing" as const,
  createdAt: new Date(),
};

const testSubscription = {
  id: `${PREFIX}-sub`,
  plan: "growth",
  referenceId: testOrg.id,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Switchable mock user
let currentMockUserId = testUser.id;

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
        user: {
          id: currentMockUserId,
          email:
            currentMockUserId === testUser.id
              ? testUser.email
              : billingUser.email,
          name:
            currentMockUserId === testUser.id
              ? testUser.name
              : billingUser.name,
        },
        session: {
          id: `${PREFIX}-session`,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: currentMockUserId,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: `${PREFIX}-token`,
        },
      })),
    },
  },
}));

beforeAll(async () => {
  await db
    .insert(user)
    .values(testUser)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });

  await db
    .insert(user)
    .values(billingUser)
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
    .onConflictDoUpdate({
      target: member.id,
      set: { role: ownerMember.role },
    });

  await db
    .insert(member)
    .values(billingMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: billingMember.role },
    });

  await db.delete(subscription).where(eq(subscription.referenceId, testOrg.id));
  await db.insert(subscription).values(testSubscription);
});

beforeEach(() => {
  currentMockUserId = testUser.id;
});

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.organizationId, testOrg.id));
  await db.delete(topic).where(eq(topic.organizationId, testOrg.id));
  await db.delete(member).where(eq(member.id, ownerMember.id));
  await db.delete(member).where(eq(member.id, billingMember.id));
  await db.delete(subscription).where(eq(subscription.referenceId, testOrg.id));
  await db.delete(organization).where(eq(organization.id, testOrg.id));
  await db.delete(user).where(eq(user.id, testUser.id));
  await db.delete(user).where(eq(user.id, billingUser.id));
});

describe("orgAction wrapper", () => {
  describe("1. Unauthorized — no membership", () => {
    it("returns unauthorized error and does not call handler when session user has no membership", async () => {
      const handler = vi.fn(async () => ({ success: true as const }));

      // Use a user ID that has no membership in testOrg
      currentMockUserId = "non-existent-user-no-membership";

      const action = orgAction(
        {
          name: "testAction",
          resource: "topics",
          permission: ["read"],
          orgId: (orgId: string) => orgId,
          onError: "Failed",
        },
        handler
      );

      const result = await action(testOrg.id);

      expect(result).toEqual({
        success: false,
        error: "You don't have access to this organization",
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("2. Permission denied", () => {
    it("returns permission error and does not call handler when billing role attempts write", async () => {
      const handler = vi.fn(async () => ({ success: true as const }));
      currentMockUserId = billingUser.id;

      const action = orgAction(
        {
          name: "testWriteAction",
          resource: "topics",
          permission: ["write"],
          orgId: (orgId: string) => orgId,
          onError: "Failed",
        },
        handler
      );

      const result = await action(testOrg.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("permission");
      }
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("3. Happy path read", () => {
    it("runs handler and passes ctx with correct organizationId and access fields", async () => {
      let capturedCtx: {
        organizationId: string;
        orgSlug: string;
        userId: string;
      } | null = null;

      const action = orgAction(
        {
          name: "testReadAction",
          resource: "topics",
          permission: ["read"],
          orgId: (orgId: string) => orgId,
          onError: "Failed",
        },
        async (ctx) => {
          capturedCtx = {
            organizationId: ctx.organizationId,
            orgSlug: ctx.access.orgSlug,
            userId: ctx.access.userId,
          };
          return { success: true as const, value: 42 };
        }
      );

      const result = await action(testOrg.id);

      expect(result).toEqual({ success: true, value: 42 });
      expect(capturedCtx).toEqual({
        organizationId: testOrg.id,
        orgSlug: testOrg.slug,
        userId: testUser.id,
      });
    });
  });

  describe("4. audited writes the audit row atomically", () => {
    it("inserts topic + audit row in one transaction with correct fields", async () => {
      const topicId = `${PREFIX}-audited-topic`;

      const action = orgAction(
        {
          name: "testAuditedAction",
          resource: "topics",
          permission: ["write"],
          orgId: (orgId: string) => orgId,
          onError: "Failed",
        },
        async (ctx, orgId: string) => {
          const inserted = await ctx.audited(
            async (tx) => {
              const [r] = await tx
                .insert(topic)
                .values({
                  id: topicId,
                  organizationId: orgId,
                  name: "Audited Topic",
                  slug: `${PREFIX}-audited-topic`,
                  description: null,
                  public: true,
                  doubleOptIn: false,
                  createdBy: ctx.access.userId,
                })
                .returning();
              return r;
            },
            (r) => ({
              action: "topic.created" as const,
              resource: "topic",
              resourceId: r.id,
              metadata: {
                topicId: r.id,
                name: r.name,
                createdBy: ctx.access.userId,
              },
            })
          );
          return { success: true as const, topicId: inserted.id };
        }
      );

      const result = await action(testOrg.id);
      expect(result.success).toBe(true);

      // Verify topic was written
      const topicRow = await db.query.topic.findFirst({
        where: (t, { eq }) => eq(t.id, topicId),
      });
      expect(topicRow).toBeTruthy();
      expect(topicRow?.name).toBe("Audited Topic");

      // Verify audit row with correct fields
      const auditRows = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.organizationId, testOrg.id),
            eq(auditLog.action, "topic.created"),
            eq(auditLog.resourceId, topicId)
          )
        );

      expect(auditRows.length).toBe(1);
      const row = auditRows[0];
      expect(row.organizationId).toBe(testOrg.id);
      expect(row.userId).toBe(testUser.id);
      expect(row.actorEmail).toBe(testUser.email);
      expect(row.action).toBe("topic.created");
      expect(row.resource).toBe("topic");
      expect(row.resourceId).toBe(topicId);
      expect(row.metadata).toMatchObject({ topicId, name: "Audited Topic" });
    });
  });

  describe("5. Rollback on error", () => {
    it("rolls back both topic and audit row when audited fn throws after insert", async () => {
      const topicId = `${PREFIX}-rollback-topic`;

      const action = orgAction(
        {
          name: "testRollbackAction",
          resource: "topics",
          permission: ["write"],
          orgId: (orgId: string) => orgId,
          onError: "Failed to write",
        },
        async (ctx, orgId: string) => {
          await ctx.audited(
            async (tx) => {
              await tx.insert(topic).values({
                id: topicId,
                organizationId: orgId,
                name: "Should Rollback",
                slug: `${PREFIX}-rollback-topic`,
                description: null,
                public: true,
                doubleOptIn: false,
                createdBy: ctx.access.userId,
              });
              // Throw AFTER insert to trigger rollback
              throw new Error("Simulated failure after insert");
            },
            () => ({
              action: "topic.created" as const,
              resource: "topic",
            })
          );
          return { success: true as const };
        }
      );

      const result = await action(testOrg.id);

      expect(result).toEqual({ success: false, error: "Failed to write" });

      // Topic row should NOT exist (transaction rolled back)
      const topicRow = await db.query.topic.findFirst({
        where: (t, { eq }) => eq(t.id, topicId),
      });
      expect(topicRow).toBeUndefined();

      // Audit row should NOT exist
      const auditRows = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.organizationId, testOrg.id),
            eq(auditLog.resourceId, topicId)
          )
        );
      expect(auditRows.length).toBe(0);
    });
  });

  describe("6. formState passthrough", () => {
    it("returns formState directly when handler throws with formState key", async () => {
      const formState = {
        marker: 1,
        success: false as const,
        error: "form validation failed",
      };

      const action = orgAction(
        {
          name: "testFormStateAction",
          resource: "topics",
          permission: ["read"],
          orgId: (orgId: string) => orgId,
          onError: "Failed",
        },
        async () => {
          throw { formState };
        }
      );

      const result = await action(testOrg.id);
      expect(result).toEqual(formState);
    });
  });
});
