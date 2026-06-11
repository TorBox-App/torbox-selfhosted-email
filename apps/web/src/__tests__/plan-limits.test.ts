import { db, subscription } from "@wraps/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupPermissionFixtures } from "@/lib/permissions/__tests__/setup";
import { checkFeatureAccess } from "@/lib/plan-limits";

const { testOrganization } = setupPermissionFixtures("plan-limits");
const testSubscriptionId = `${testOrganization.id}-sub`;

describe("checkFeatureAccess - sso", () => {
  it("returns { allowed: false } when no subscription exists (free plan)", async () => {
    const result = await checkFeatureAccess(testOrganization.id, "sso");
    expect(result.allowed).toBe(false);
  });

  describe("with scale subscription", () => {
    beforeEach(async () => {
      await db.insert(subscription).values({
        id: testSubscriptionId,
        plan: "scale",
        referenceId: testOrganization.id,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    afterEach(async () => {
      await db
        .delete(subscription)
        .where(eq(subscription.id, testSubscriptionId));
    });

    it("returns { allowed: true } when org has active scale subscription", async () => {
      const result = await checkFeatureAccess(testOrganization.id, "sso");
      expect(result.allowed).toBe(true);
    });
  });
});
