/**
 * Tests for broadcast pre-flight template variable coverage validation.
 *
 * Tests the `checkTemplateVariableCoverage` action which detects when
 * template variables cannot be resolved for contacts in the audience,
 * and the `promoteDraftToSend` block that prevents all-fail sends.
 */

import {
  awsAccount,
  batchSend,
  contact,
  db,
  member,
  organization,
  organizationExtension,
  subscription,
  template,
  user,
} from "@wraps/db";
import { eq, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { checkFeatureAccess } from "@/lib/plan-limits";
import { checkTemplateVariableCoverage, promoteDraftToSend, saveDraftBatchSend } from "../batch";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const RUN_ID = crypto.randomUUID().slice(0, 8);

const testUser = {
  id: `preflight-user-${RUN_ID}`,
  email: `preflight-owner-${RUN_ID}@example.com`,
  name: "Preflight Owner",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: `preflight-org-${RUN_ID}`,
  name: "Preflight Test Org",
  slug: `preflight-test-org-${RUN_ID}`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testOwnerMember = {
  id: `preflight-owner-member-${RUN_ID}`,
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testAwsAccount = {
  id: `preflight-aws-${RUN_ID}`,
  organizationId: testOrganization.id,
  accountId: "111122223333",
  region: "us-east-1",
  roleArn: "arn:aws:iam::111122223333:role/test-role",
  externalId: `preflight-ext-${RUN_ID}`,
  name: "Preflight AWS Account",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
};

// Template with ONLY known contact variables — no custom vars
const templateNoCustomVars = {
  id: `preflight-tmpl-known-${RUN_ID}`,
  organizationId: testOrganization.id,
  name: "Known Vars Template",
  subject: "Hello {{contact.firstName}}",
  content: {},
  sourceFormat: "react-email" as const,
  variables: [
    { name: "contact.firstName", fallback: undefined },
    { name: "unsubscribeUrl", fallback: undefined },
  ],
  status: "PUBLISHED" as const,
  type: "EMAIL" as const,
  sesTemplateName: `wraps-org-preflight-known-${RUN_ID}`,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date("2025-12-01"),
  createdBy: testUser.id,
};

// Template with ONE custom variable (no fallback)
const templateWithCustomVar = {
  id: `preflight-tmpl-custom-${RUN_ID}`,
  organizationId: testOrganization.id,
  name: "Custom Var Template",
  subject: "Your dashboard",
  content: {},
  sourceFormat: "react-email" as const,
  variables: [
    { name: "contact.firstName", fallback: undefined },
    { name: "dashboardUrl", fallback: undefined }, // custom, no fallback
  ],
  status: "PUBLISHED" as const,
  type: "EMAIL" as const,
  sesTemplateName: `wraps-org-preflight-custom-${RUN_ID}`,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date("2025-12-01"),
  createdBy: testUser.id,
};

// Template with a custom variable that HAS a fallback
const templateWithFallback = {
  id: `preflight-tmpl-fallback-${RUN_ID}`,
  organizationId: testOrganization.id,
  name: "Fallback Template",
  subject: "Your account",
  content: {},
  sourceFormat: "react-email" as const,
  variables: [
    { name: "dashboardUrl", fallback: "https://default.example.com" }, // has fallback
  ],
  status: "PUBLISHED" as const,
  type: "EMAIL" as const,
  sesTemplateName: `wraps-org-preflight-fallback-${RUN_ID}`,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date("2025-12-01"),
  createdBy: testUser.id,
};

// Contact that HAS the dashboardUrl property
const contactWithProp = {
  id: `preflight-contact-has-${RUN_ID}`,
  organizationId: testOrganization.id,
  email: `has-prop-${RUN_ID}@example.com`,
  emailHash: `hash-has-${RUN_ID}`,
  emailStatus: "active" as const,
  properties: { dashboardUrl: "https://myapp.example.com/dashboard" },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// Contact that does NOT have dashboardUrl
const contactWithoutProp = {
  id: `preflight-contact-nope-${RUN_ID}`,
  organizationId: testOrganization.id,
  email: `no-prop-${RUN_ID}@example.com`,
  emailHash: `hash-nope-${RUN_ID}`,
  emailStatus: "active" as const,
  properties: {},
  createdAt: new Date("2026-01-02"),
  updatedAt: new Date("2026-01-02"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

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
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        session: {
          id: "session-preflight",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token-preflight",
        },
      })),
    },
  },
}));

vi.mock("@/lib/plan-limits", () => ({
  checkFeatureAccess: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/actions/templates", () => ({
  publishTemplateToSES: vi.fn(async () => ({
    success: true,
    sesTemplateName: "wraps-test-template",
  })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

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
    .insert(organizationExtension)
    .values({ organizationId: testOrganization.id })
    .onConflictDoUpdate({
      target: organizationExtension.organizationId,
      set: { updatedAt: new Date() },
    });

  await db
    .insert(subscription)
    .values({
      id: `sub_preflight_${RUN_ID}`,
      plan: "growth",
      referenceId: testOrganization.id,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscription.id,
      set: { plan: "growth", status: "active" },
    });

  await db
    .insert(member)
    .values(testOwnerMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testOwnerMember.role },
    });

  await db
    .insert(awsAccount)
    .values(testAwsAccount)
    .onConflictDoUpdate({
      target: awsAccount.id,
      set: { name: testAwsAccount.name },
    });

  await db
    .insert(template)
    .values([templateNoCustomVars, templateWithCustomVar, templateWithFallback])
    .onConflictDoNothing();

  await db
    .insert(contact)
    .values([contactWithProp, contactWithoutProp])
    .onConflictDoNothing();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await db
    .delete(batchSend)
    .where(eq(batchSend.organizationId, testOrganization.id));
  await db.delete(contact).where(eq(contact.organizationId, testOrganization.id));
  await db.delete(template).where(eq(template.id, templateNoCustomVars.id));
  await db.delete(template).where(eq(template.id, templateWithCustomVar.id));
  await db.delete(template).where(eq(template.id, templateWithFallback.id));
  await db.delete(awsAccount).where(eq(awsAccount.id, testAwsAccount.id));
  await db.delete(member).where(eq(member.id, testOwnerMember.id));
  await db
    .delete(subscription)
    .where(eq(subscription.id, `sub_preflight_${RUN_ID}`));
  await db
    .delete(organizationExtension)
    .where(eq(organizationExtension.organizationId, testOrganization.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 2: clean when template has no custom variables
// ─────────────────────────────────────────────────────────────────────────────

describe("checkTemplateVariableCoverage — no custom variables", () => {
  it("returns allFail=false and missingCount=0 when template only uses known contact variables", async () => {
    const result = await checkTemplateVariableCoverage(
      testOrganization.id,
      templateNoCustomVars.id,
      { audienceType: "all" }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.allFail).toBe(false);
    expect(result.missingCount).toBe(0);
    expect(result.missingVariables).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 3: warning when SOME contacts are missing a custom variable
// ─────────────────────────────────────────────────────────────────────────────

describe("checkTemplateVariableCoverage — partial coverage", () => {
  it("returns allFail=false and missingCount>0 when one contact is missing the custom variable", async () => {
    // contactWithProp has dashboardUrl, contactWithoutProp does not
    const result = await checkTemplateVariableCoverage(
      testOrganization.id,
      templateWithCustomVar.id,
      { audienceType: "all" }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.allFail).toBe(false);
    expect(result.missingCount).toBeGreaterThan(0);
    expect(result.missingCount).toBeLessThan(result.totalSampled);
    expect(result.missingVariables).toContain("dashboardUrl");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 4: allFail=true when all contacts are missing the variable
// ─────────────────────────────────────────────────────────────────────────────

describe("checkTemplateVariableCoverage — all contacts missing variable", () => {
  it("returns allFail=true when no contact in the audience has the required variable", async () => {
    // Use a template with a variable ("dashboardUrl") but only the contact
    // WITHOUT it — filter audience to topic we know only has that contact.
    // Simplest approach: use a separate contact-only audience by temporarily
    // setting up a scenario where only contactWithoutProp is reachable.
    // We can test this by creating a separate org with only the no-prop contact.
    const allFailOrgId = `preflight-allfail-org-${RUN_ID}`;
    const allFailContactId = `preflight-allfail-contact-${RUN_ID}`;

    await db
      .insert(organization)
      .values({
        id: allFailOrgId,
        name: "All Fail Org",
        slug: `allfail-${RUN_ID}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(member)
      .values({
        id: `preflight-allfail-member-${RUN_ID}`,
        organizationId: allFailOrgId,
        userId: testUser.id,
        role: "owner" as const,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values({
        id: allFailContactId,
        organizationId: allFailOrgId,
        email: `allfail-${RUN_ID}@example.com`,
        emailHash: `hash-allfail-${RUN_ID}`,
        emailStatus: "active" as const,
        properties: {}, // missing dashboardUrl
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    const allFailTemplate = {
      id: `preflight-allfail-tmpl-${RUN_ID}`,
      organizationId: allFailOrgId,
      name: "All Fail Template",
      subject: "Your dashboard",
      content: {},
      sourceFormat: "react-email" as const,
      variables: [{ name: "dashboardUrl", fallback: undefined }],
      status: "PUBLISHED" as const,
      type: "EMAIL" as const,
      sesTemplateName: `wraps-allfail-${RUN_ID}`,
      publishedAt: new Date("2026-01-01"),
      createdAt: new Date(),
      updatedAt: new Date("2025-12-01"),
      createdBy: testUser.id,
    };

    await db.insert(template).values(allFailTemplate).onConflictDoNothing();

    try {
      const result = await checkTemplateVariableCoverage(
        allFailOrgId,
        allFailTemplate.id,
        { audienceType: "all" }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.allFail).toBe(true);
      expect(result.missingCount).toBe(result.totalSampled);
      expect(result.missingVariables).toContain("dashboardUrl");
    } finally {
      await db.delete(template).where(eq(template.id, allFailTemplate.id));
      await db.delete(contact).where(eq(contact.id, allFailContactId));
      await db.delete(member).where(eq(member.organizationId, allFailOrgId));
      await db.delete(organization).where(eq(organization.id, allFailOrgId));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 5: ignores variables that have a fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("checkTemplateVariableCoverage — fallback variables are safe", () => {
  it("returns allFail=false and missingCount=0 when the custom variable has a fallback", async () => {
    // templateWithFallback has dashboardUrl with a fallback — contacts
    // without dashboardUrl in properties should NOT count as missing.
    const result = await checkTemplateVariableCoverage(
      testOrganization.id,
      templateWithFallback.id,
      { audienceType: "all" }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.allFail).toBe(false);
    expect(result.missingCount).toBe(0);
    expect(result.missingVariables).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 6: ignores variables covered by a static mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("checkTemplateVariableCoverage — static mappings cover variables", () => {
  it("returns allFail=false and missingCount=0 when the variable is covered by a static mapping", async () => {
    // templateWithCustomVar has dashboardUrl (no fallback), but we supply
    // a static mapping for it → should be safe for all contacts.
    const result = await checkTemplateVariableCoverage(
      testOrganization.id,
      templateWithCustomVar.id,
      { audienceType: "all" },
      [
        {
          variableName: "dashboardUrl",
          source: { type: "static", value: "https://static.example.com" },
        },
      ]
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.allFail).toBe(false);
    expect(result.missingCount).toBe(0);
    expect(result.missingVariables).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 7: promoteDraftToSend blocks when all contacts would fail rendering
// ─────────────────────────────────────────────────────────────────────────────

describe("promoteDraftToSend — blocks all-fail sends", () => {
  it("returns an error when every contact in the audience is missing required template variables", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    // Mock fetch so the test doesn't hang if the coverage check somehow
    // doesn't block. In the expected (green) path, fetch is never called.
    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (...args: Parameters<typeof fetch>) => {
        const [url] = args;
        const asString = typeof url === "string" ? url : url.toString();
        if (asString.includes("/v1/batch/")) {
          return new Response(JSON.stringify({ id: "mock-id" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return realFetch(...args);
      });
    const blockOrgId = `preflight-block-org-${RUN_ID}`;
    const blockContactId = `preflight-block-contact-${RUN_ID}`;
    const blockMemberId = `preflight-block-member-${RUN_ID}`;
    const blockAwsId = `preflight-block-aws-${RUN_ID}`;
    const blockSubId = `sub_preflight_block_${RUN_ID}`;

    await db
      .insert(organization)
      .values({
        id: blockOrgId,
        name: "Block Test Org",
        slug: `block-org-${RUN_ID}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(organizationExtension)
      .values({ organizationId: blockOrgId })
      .onConflictDoNothing();

    await db
      .insert(subscription)
      .values({
        id: blockSubId,
        plan: "growth",
        referenceId: blockOrgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(member)
      .values({
        id: blockMemberId,
        organizationId: blockOrgId,
        userId: testUser.id,
        role: "owner" as const,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: blockAwsId,
        organizationId: blockOrgId,
        externalId: `block-ext-${RUN_ID}`,
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values({
        id: blockContactId,
        organizationId: blockOrgId,
        email: `block-contact-${RUN_ID}@example.com`,
        emailHash: `hash-block-${RUN_ID}`,
        emailStatus: "active" as const,
        properties: {}, // missing dashboardUrl
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Template in the block org that requires dashboardUrl (no fallback)
    const blockTemplate = {
      id: `preflight-block-tmpl-${RUN_ID}`,
      organizationId: blockOrgId,
      name: "Block Template",
      subject: "Your dashboard",
      content: {},
      sourceFormat: "react-email" as const,
      variables: [{ name: "dashboardUrl", fallback: undefined }],
      status: "PUBLISHED" as const,
      type: "EMAIL" as const,
      sesTemplateName: `wraps-block-tmpl-${RUN_ID}`,
      publishedAt: new Date("2026-01-01"),
      createdAt: new Date(),
      updatedAt: new Date("2025-12-01"),
      createdBy: testUser.id,
    };

    await db.insert(template).values(blockTemplate).onConflictDoNothing();

    try {
      const draft = await saveDraftBatchSend(blockOrgId, {
        awsAccountId: blockAwsId,
        templateId: blockTemplate.id,
        from: "sender@example.com",
        subject: "Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(draft.batch.id, blockOrgId, {});

      expect(result.success).toBe(false);
      if (result.success) return;
      // Error message should mention the template variable issue
      expect(result.error).toMatch(/variable|template|missing/i);

      // Draft row unchanged
      const after = await db.query.batchSend.findFirst({
        where: eq(batchSend.id, draft.batch.id),
      });
      expect(after?.status).toBe("draft");
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db.delete(batchSend).where(eq(batchSend.organizationId, blockOrgId));
      await db.delete(template).where(eq(template.id, blockTemplate.id));
      await db.delete(contact).where(eq(contact.id, blockContactId));
      await db.delete(awsAccount).where(eq(awsAccount.id, blockAwsId));
      await db.delete(member).where(eq(member.id, blockMemberId));
      await db.delete(subscription).where(eq(subscription.id, blockSubId));
      await db
        .delete(organizationExtension)
        .where(eq(organizationExtension.organizationId, blockOrgId));
      await db.delete(organization).where(eq(organization.id, blockOrgId));
    }
  });
});
