import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  createFreeSubscription,
  getActiveSubscription,
} from "../repositories/subscriptions";
import { organization, subscription } from "../schema";

const testOrgId = `repo-sub-test-org-${crypto.randomUUID()}`;
const testUserId = `repo-sub-test-user-${crypto.randomUUID()}`;

describe("Repository: subscriptions", () => {
  beforeAll(async () => {
    // Create org so FK constraint is satisfied when we insert subscriptions
    await db
      .insert(organization)
      .values({
        id: testOrgId,
        name: "Repo Sub Test Org",
        slug: `repo-sub-test-${testOrgId.slice(-8)}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Delete subscription first (FK -> org), then org
    await db
      .delete(subscription)
      .where(eq(subscription.referenceId, testOrgId));
    await db.delete(organization).where(eq(organization.id, testOrgId));
  });

  describe("getActiveSubscription", () => {
    it("returns null when no subscription exists for org", async () => {
      const result = await getActiveSubscription("non-existent-org-id");
      expect(result).toBeNull();
    });

    it("returns the subscription record when one exists", async () => {
      const subId = crypto.randomUUID();
      await db.insert(subscription).values({
        id: subId,
        plan: "free",
        referenceId: testOrgId,
        status: "active",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        periodStart: null,
        periodEnd: null,
        cancelAtPeriodEnd: false,
        seats: 1,
        annual: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getActiveSubscription(testOrgId);

      expect(result).not.toBeNull();
      expect(result?.referenceId).toBe(testOrgId);
      expect(result?.plan).toBe("free");
      expect(result?.status).toBe("active");
    });
  });

  describe("createFreeSubscription", () => {
    it("inserts a free subscription and returns it", async () => {
      // Clean up any existing sub for this org before creating
      await db
        .delete(subscription)
        .where(eq(subscription.referenceId, testOrgId));

      const result = await createFreeSubscription(testOrgId, testUserId);

      expect(result).not.toBeNull();
      expect(result.referenceId).toBe(testOrgId);
      expect(result.plan).toBe("free");
      expect(result.status).toBe("active");
      expect(result.annual).toBe(false);
    });
  });
});
