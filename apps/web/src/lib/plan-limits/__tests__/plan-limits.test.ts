import { createHmac } from "node:crypto";
import {
  awsAccount,
  contact,
  db,
  member,
  organization,
  organizationExtension,
  subscription,
  user,
  workflow,
} from "@wraps/db";
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
  checkAwsAccountLimit,
  checkContactLimit,
  checkFeatureAccess,
  checkTeamMemberLimit,
  checkWorkflowLimit,
  getOrganizationPlan,
} from "../index";

// Signing secret must match the embedded constant in plan-limits/index.ts
const WEB_SIGNING_SECRET =
  "wraps-1-f2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2";

function makeWebLicenseKey(tier: string, expires: string): string {
  const payload = `v1.${tier}.${expires}`;
  const hmac = createHmac("sha256", WEB_SIGNING_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${hmac}`;
}

// Test data
const testOrgId = "plan-limits-test-org";
const testOrg = {
  id: testOrgId,
  name: "Plan Limits Test Org",
  slug: "plan-limits-test-org",
  createdAt: new Date(),
};

describe("Plan Limits", () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await db
      .delete(subscription)
      .where(eq(subscription.referenceId, testOrgId));
    await db
      .delete(organizationExtension)
      .where(eq(organizationExtension.organizationId, testOrgId));
    await db.delete(organization).where(eq(organization.id, testOrgId));

    // Create test organization
    await db.insert(organization).values(testOrg);

    // Create organization extension
    await db.insert(organizationExtension).values({
      organizationId: testOrgId,
      awsAccountCount: 0,
      memberCount: 1,
      onboardingCompleted: true,
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    // Clean up
    await db
      .delete(subscription)
      .where(eq(subscription.referenceId, testOrgId));
    await db.delete(contact).where(eq(contact.organizationId, testOrgId));
    await db
      .delete(organizationExtension)
      .where(eq(organizationExtension.organizationId, testOrgId));
    await db.delete(organization).where(eq(organization.id, testOrgId));
  });

  beforeEach(async () => {
    // Clean up subscriptions before each test
    await db
      .delete(subscription)
      .where(eq(subscription.referenceId, testOrgId));
  });

  describe("getOrganizationPlan", () => {
    it("should return free when no subscription exists", async () => {
      // With 2026 pricing model, orgs without subscription get free tier
      const plan = await getOrganizationPlan(testOrgId);
      expect(plan).toBe("free");
    });

    it("should return plan from active subscription", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "growth",
        referenceId: testOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const plan = await getOrganizationPlan(testOrgId);
      expect(plan).toBe("growth");
    });

    it("should return plan from trialing subscription", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "scale",
        referenceId: testOrgId,
        status: "trialing",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const plan = await getOrganizationPlan(testOrgId);
      expect(plan).toBe("scale");
    });

    it("should return free for canceled subscription", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "growth",
        referenceId: testOrgId,
        status: "canceled",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const plan = await getOrganizationPlan(testOrgId);
      expect(plan).toBe("free"); // Canceled subscriptions fall back to free tier
    });

    it("should return free for past_due subscription", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "growth",
        referenceId: testOrgId,
        status: "past_due",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const plan = await getOrganizationPlan(testOrgId);
      expect(plan).toBe("free"); // Past due subscriptions fall back to free tier
    });

    describe("license key override", () => {
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it("returns licensed tier without querying DB when WRAPS_LICENSE_KEY is valid", async () => {
        // Use an org ID that has no DB record — if DB is queried it would return "free"
        const nonExistentOrgId = "license-override-test-no-db-record";
        vi.stubEnv(
          "WRAPS_LICENSE_KEY",
          makeWebLicenseKey("scale", "2099-12-31")
        );

        const plan = await getOrganizationPlan(nonExistentOrgId);

        // Only possible if license key is applied — no DB record exists for this org
        expect(plan).toBe("scale");
      });

      it("falls back to DB subscription when WRAPS_LICENSE_KEY is not set", async () => {
        await db.insert(subscription).values({
          id: `sub_test_${Date.now()}`,
          plan: "growth",
          referenceId: testOrgId,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const plan = await getOrganizationPlan(testOrgId);

        expect(plan).toBe("growth"); // From DB, not license key
      });
    });
  });

  describe("checkContactLimit", () => {
    it("should return allowed for free plan (unlimited contacts)", async () => {
      // Free tier has unlimited contacts
      const result = await checkContactLimit(testOrgId);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1); // Unlimited
    });

    it("should return allowed for starter plan within limit", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "starter",
        referenceId: testOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkContactLimit(testOrgId);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      // Starter plan has unlimited contacts (-1) in the 2026 pricing model
      expect(result.limit).toBe(-1);
    });

    it("should return accurate count when contacts exist", async () => {
      // Insert 5 contacts for the test org
      const contacts = Array.from({ length: 5 }, (_, i) => ({
        organizationId: testOrgId,
        email: `count-test-${i}@example.com`,
      }));
      await db.insert(contact).values(contacts);

      try {
        const result = await checkContactLimit(testOrgId);
        expect(result.current).toBe(5);
      } finally {
        // Clean up contacts
        await db.delete(contact).where(eq(contact.organizationId, testOrgId));
      }
    });
  });

  describe("checkAwsAccountLimit", () => {
    it("should return allowed for free plan (no subscription) within limit", async () => {
      // Free tier allows 1 AWS account
      const result = await checkAwsAccountLimit(testOrgId);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(1); // Free plan has 1 AWS account
    });

    it("should return allowed for starter plan within limit", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "starter",
        referenceId: testOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkAwsAccountLimit(testOrgId);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(1); // Starter plan has 1 AWS account
    });

    it("should return accurate count when AWS accounts exist", async () => {
      await db.insert(awsAccount).values({
        organizationId: testOrgId,
        name: "count-test-account",
        accountId: "123456789012",
        region: "us-east-1",
        roleArn: "arn:aws:iam::123456789012:role/test",
        externalId: `count-test-ext-${Date.now()}`,
      });

      try {
        const result = await checkAwsAccountLimit(testOrgId);
        expect(result.current).toBe(1);
      } finally {
        await db
          .delete(awsAccount)
          .where(eq(awsAccount.organizationId, testOrgId));
      }
    });
  });

  describe("checkWorkflowLimit", () => {
    it("should return accurate count when workflows exist", async () => {
      const workflows = Array.from({ length: 3 }, (_, i) => ({
        organizationId: testOrgId,
        name: `count-test-workflow-${i}`,
      }));
      await db.insert(workflow).values(workflows);

      try {
        const result = await checkWorkflowLimit(testOrgId);
        expect(result.current).toBe(3);
      } finally {
        await db.delete(workflow).where(eq(workflow.organizationId, testOrgId));
      }
    });
  });

  describe("checkTeamMemberLimit", () => {
    const testUserId = "plan-limits-test-user";

    it("should return accurate count when members exist", async () => {
      // Clean up any leftover test data
      await db.delete(member).where(eq(member.organizationId, testOrgId));
      await db.delete(user).where(eq(user.id, testUserId));

      // Create test user for FK constraint
      await db.insert(user).values({
        id: testUserId,
        name: "Test User",
        email: `plan-limits-test-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(member).values({
        id: `plan-limits-member-${Date.now()}`,
        organizationId: testOrgId,
        userId: testUserId,
        role: "member",
        createdAt: new Date(),
      });

      try {
        const result = await checkTeamMemberLimit(testOrgId);
        expect(result.current).toBe(1);
      } finally {
        await db.delete(member).where(eq(member.organizationId, testOrgId));
        await db.delete(user).where(eq(user.id, testUserId));
      }
    });
  });

  describe("checkFeatureAccess", () => {
    it("should return not allowed for free plan accessing starter feature", async () => {
      // Free tier doesn't have topics - requires Starter plan
      const result = await checkFeatureAccess(testOrgId, "topics");

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("requires a Starter plan");
      expect(result.requiredPlan).toBe("starter");
    });

    it("should return allowed for starter plan accessing starter feature", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "starter",
        referenceId: testOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkFeatureAccess(testOrgId, "topics");

      expect(result.allowed).toBe(true);
      expect(result.requiredPlan).toBe("starter");
    });

    it("should return not allowed for starter plan accessing scale feature", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "starter",
        referenceId: testOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkFeatureAccess(testOrgId, "advancedSegments");

      expect(result.allowed).toBe(false);
      expect(result.requiredPlan).toBe("scale");
    });

    it("should return allowed for starter plan accessing batch feature", async () => {
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "starter",
        referenceId: testOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkFeatureAccess(testOrgId, "batch");

      expect(result.allowed).toBe(true);
    });

    it("should return allowed for starter plan accessing workflows", async () => {
      // Workflows are available for all tiers (free+) with different limits
      await db.insert(subscription).values({
        id: `sub_test_${Date.now()}`,
        plan: "starter",
        referenceId: testOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkFeatureAccess(testOrgId, "workflows");

      expect(result.allowed).toBe(true);
      expect(result.requiredPlan).toBe("free"); // Workflows available on free tier
    });
  });
});
