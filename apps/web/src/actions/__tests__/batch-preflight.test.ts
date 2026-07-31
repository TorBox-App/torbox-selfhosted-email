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
import {
  checkTemplateVariableCoverage,
  createBatchSend,
  promoteDraftToSend,
  saveDraftBatchSend,
} from "../batch";

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

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => unknown) => fn()),
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
// Daily quota reserve preflight mocks — AssumeRole + SES GetAccount
// ─────────────────────────────────────────────────────────────────────────────

const getOrAssumeRoleMock = vi.fn().mockResolvedValue({
  accessKeyId: "AKIA-test",
  secretAccessKey: "secret-test",
  sessionToken: "token-test",
  expiration: new Date("2099-01-01"),
});

vi.mock("@/lib/aws/credential-cache", () => ({
  getOrAssumeRole: (...args: unknown[]) => getOrAssumeRoleMock(...args),
}));

let sesGetAccountShouldThrow = false;
let sesGetAccountQuota: {
  Max24HourSend?: number;
  SentLast24Hours?: number;
} | null = null;

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn().mockImplementation(() => {
      if (sesGetAccountShouldThrow) {
        return Promise.reject(new Error("GetAccount failed: network error"));
      }
      return Promise.resolve({ SendQuota: sesGetAccountQuota ?? {} });
    });
  },
  GetAccountCommand: class {
    constructor(public input: unknown) {}
  },
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
  sesGetAccountShouldThrow = false;
  sesGetAccountQuota = null;
  getOrAssumeRoleMock.mockResolvedValue({
    accessKeyId: "AKIA-test",
    secretAccessKey: "secret-test",
    sessionToken: "token-test",
    expiration: new Date("2099-01-01"),
  });
});

afterAll(async () => {
  await db
    .delete(batchSend)
    .where(eq(batchSend.organizationId, testOrganization.id));
  await db
    .delete(contact)
    .where(eq(contact.organizationId, testOrganization.id));
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
// Unit 2b: handlebars block tags in the subject are not treated as variables
// ─────────────────────────────────────────────────────────────────────────────

describe("checkTemplateVariableCoverage — handlebars conditionals in subject", () => {
  it("does not report {{#if}}/{{/if}} block tags as missing variables", async () => {
    // Regression: the subject parser captured "#if firstName" and "/if" as
    // variable names, so every contact was reported as missing them.
    const conditionalTemplate = {
      ...templateNoCustomVars,
      id: `preflight-tmpl-cond-${RUN_ID}`,
      name: "Conditional Subject Template",
      subject:
        "The setup just got easier{{#if firstName}}, {{firstName}}{{/if}}.",
      variables: [],
      sesTemplateName: `wraps-org-preflight-cond-${RUN_ID}`,
    };

    await db.insert(template).values(conditionalTemplate).onConflictDoNothing();

    try {
      const result = await checkTemplateVariableCoverage(
        testOrganization.id,
        conditionalTemplate.id,
        { audienceType: "all" }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.allFail).toBe(false);
      expect(result.missingCount).toBe(0);
      expect(result.missingVariables).toHaveLength(0);
    } finally {
      await db.delete(template).where(eq(template.id, conditionalTemplate.id));
    }
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
// Unit 6b: contact-field mappings resolve from the column, not properties
// ─────────────────────────────────────────────────────────────────────────────

describe("checkTemplateVariableCoverage — contact-field mappings", () => {
  it("reads the mapped contact column instead of a same-named custom property", async () => {
    // dashboardUrl is mapped to the contact's email column. Neither sampled
    // contact has a dashboardUrl property, but both have an email, so the
    // variable resolves for everyone.
    const result = await checkTemplateVariableCoverage(
      testOrganization.id,
      templateWithCustomVar.id,
      { audienceType: "all" },
      [
        {
          variableName: "dashboardUrl",
          source: { type: "contact", field: "email" },
        },
      ]
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.allFail).toBe(false);
    expect(result.missingCount).toBe(0);
  });

  it("still reports contacts whose mapped column is empty", async () => {
    // firstName is unset on both fixture contacts, so a mapping to it leaves
    // every contact unresolved.
    const result = await checkTemplateVariableCoverage(
      testOrganization.id,
      templateWithCustomVar.id,
      { audienceType: "all" },
      [
        {
          variableName: "dashboardUrl",
          source: { type: "contact", field: "firstName" },
        },
      ]
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.missingCount).toBe(result.totalSampled);
    expect(result.missingVariables).toContain("dashboardUrl");
  });

  it("resolves a properties.<key> mapping the same way the send worker does", async () => {
    // The API accepts any field string and the worker resolves the
    // "properties." prefix, so the preflight has to as well. The variable
    // (ctaUrl) is deliberately named differently from the property it maps
    // to (dashboardUrl) — reading the variable name off properties, as the
    // unmapped path does, would report every contact as missing.
    const renamedVarTemplate = {
      ...templateWithCustomVar,
      id: `preflight-tmpl-renamed-${RUN_ID}`,
      name: "Renamed Var Template",
      variables: [{ name: "ctaUrl", fallback: undefined }],
      sesTemplateName: `wraps-org-preflight-renamed-${RUN_ID}`,
    };

    await db.insert(template).values(renamedVarTemplate).onConflictDoNothing();

    try {
      const result = await checkTemplateVariableCoverage(
        testOrganization.id,
        renamedVarTemplate.id,
        { audienceType: "all" },
        [
          {
            variableName: "ctaUrl",
            source: { type: "contact", field: "properties.dashboardUrl" },
          },
        ]
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      // contactWithProp resolves through the mapping, contactWithoutProp does not.
      expect(result.allFail).toBe(false);
      expect(result.missingCount).toBeGreaterThan(0);
      expect(result.missingCount).toBeLessThan(result.totalSampled);
    } finally {
      await db.delete(template).where(eq(template.id, renamedVarTemplate.id));
    }
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
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, blockOrgId));
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

// ─────────────────────────────────────────────────────────────────────────────
// Unit 7b: a static mapping unblocks a send no contact could otherwise pass
// ─────────────────────────────────────────────────────────────────────────────

describe("promoteDraftToSend — static mappings unblock all-fail sends", () => {
  it("sends when the required variable is covered by a static mapping instead of contact properties", async () => {
    // Regression: the send-time coverage check ignored variableMappings, so a
    // variable mapped to a static value in the wizard still blocked the send.
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    const orgId = `preflight-static-org-${RUN_ID}`;
    const contactId = `preflight-static-contact-${RUN_ID}`;
    const memberId = `preflight-static-member-${RUN_ID}`;
    const awsId = `preflight-static-aws-${RUN_ID}`;
    const subId = `sub_preflight_static_${RUN_ID}`;

    await db
      .insert(organization)
      .values({
        id: orgId,
        name: "Static Mapping Org",
        slug: `static-map-org-${RUN_ID}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(organizationExtension)
      .values({ organizationId: orgId })
      .onConflictDoNothing();

    await db
      .insert(subscription)
      .values({
        id: subId,
        plan: "growth",
        referenceId: orgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(member)
      .values({
        id: memberId,
        organizationId: orgId,
        userId: testUser.id,
        role: "owner" as const,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: awsId,
        organizationId: orgId,
        externalId: `static-map-ext-${RUN_ID}`,
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values({
        id: contactId,
        organizationId: orgId,
        email: `static-map-${RUN_ID}@example.com`,
        emailHash: `hash-static-map-${RUN_ID}`,
        emailStatus: "active" as const,
        properties: {}, // no changelogLink — only the static mapping covers it
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    const staticTemplate = {
      id: `preflight-static-tmpl-${RUN_ID}`,
      organizationId: orgId,
      name: "Static Mapping Template",
      subject: "What's new",
      content: {},
      sourceFormat: "react-email" as const,
      variables: [{ name: "changelogLink", fallback: undefined }],
      status: "PUBLISHED" as const,
      type: "EMAIL" as const,
      sesTemplateName: `wraps-static-map-${RUN_ID}`,
      publishedAt: new Date("2026-01-01"),
      createdAt: new Date(),
      updatedAt: new Date("2025-12-01"),
      createdBy: testUser.id,
    };

    await db.insert(template).values(staticTemplate).onConflictDoNothing();

    try {
      const draft = await saveDraftBatchSend(orgId, {
        awsAccountId: awsId,
        templateId: staticTemplate.id,
        from: "sender@example.com",
        subject: "What's new",
        variableMappings: [
          {
            variableName: "changelogLink",
            source: { type: "static", value: "https://torbox.cooking" },
          },
        ],
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(draft.batch.id, orgId, {});

      expect(result.success).toBe(true);
      expect(
        fetchSpy.mock.calls.some(([url]) =>
          String(url).includes(`/v1/batch/${draft.batch.id}/send`)
        )
      ).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db.delete(batchSend).where(eq(batchSend.organizationId, orgId));
      await db.delete(template).where(eq(template.id, staticTemplate.id));
      await db.delete(contact).where(eq(contact.id, contactId));
      await db.delete(awsAccount).where(eq(awsAccount.id, awsId));
      await db.delete(member).where(eq(member.id, memberId));
      await db.delete(subscription).where(eq(subscription.id, subId));
      await db
        .delete(organizationExtension)
        .where(eq(organizationExtension.organizationId, orgId));
      await db.delete(organization).where(eq(organization.id, orgId));
    }
  });

  it("still blocks when the static mapping value is blank", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    const orgId = `preflight-blank-org-${RUN_ID}`;
    const contactId = `preflight-blank-contact-${RUN_ID}`;
    const memberId = `preflight-blank-member-${RUN_ID}`;
    const awsId = `preflight-blank-aws-${RUN_ID}`;
    const subId = `sub_preflight_blank_${RUN_ID}`;

    await db
      .insert(organization)
      .values({
        id: orgId,
        name: "Blank Mapping Org",
        slug: `blank-map-org-${RUN_ID}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(organizationExtension)
      .values({ organizationId: orgId })
      .onConflictDoNothing();

    await db
      .insert(subscription)
      .values({
        id: subId,
        plan: "growth",
        referenceId: orgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(member)
      .values({
        id: memberId,
        organizationId: orgId,
        userId: testUser.id,
        role: "owner" as const,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: awsId,
        organizationId: orgId,
        externalId: `blank-map-ext-${RUN_ID}`,
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values({
        id: contactId,
        organizationId: orgId,
        email: `blank-map-${RUN_ID}@example.com`,
        emailHash: `hash-blank-map-${RUN_ID}`,
        emailStatus: "active" as const,
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    const blankTemplate = {
      id: `preflight-blank-tmpl-${RUN_ID}`,
      organizationId: orgId,
      name: "Blank Mapping Template",
      subject: "What's new",
      content: {},
      sourceFormat: "react-email" as const,
      variables: [{ name: "changelogLink", fallback: undefined }],
      status: "PUBLISHED" as const,
      type: "EMAIL" as const,
      sesTemplateName: `wraps-blank-map-${RUN_ID}`,
      publishedAt: new Date("2026-01-01"),
      createdAt: new Date(),
      updatedAt: new Date("2025-12-01"),
      createdBy: testUser.id,
    };

    await db.insert(template).values(blankTemplate).onConflictDoNothing();

    try {
      const draft = await saveDraftBatchSend(orgId, {
        awsAccountId: awsId,
        templateId: blankTemplate.id,
        from: "sender@example.com",
        subject: "What's new",
        variableMappings: [
          {
            variableName: "changelogLink",
            source: { type: "static", value: "  " },
          },
        ],
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(draft.batch.id, orgId, {});

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("changelogLink");
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db.delete(batchSend).where(eq(batchSend.organizationId, orgId));
      await db.delete(template).where(eq(template.id, blankTemplate.id));
      await db.delete(contact).where(eq(contact.id, contactId));
      await db.delete(awsAccount).where(eq(awsAccount.id, awsId));
      await db.delete(member).where(eq(member.id, memberId));
      await db.delete(subscription).where(eq(subscription.id, subId));
      await db
        .delete(organizationExtension)
        .where(eq(organizationExtension.organizationId, orgId));
      await db.delete(organization).where(eq(organization.id, orgId));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 7c: the direct-send path (no draft) applies the same mapping rules
// ─────────────────────────────────────────────────────────────────────────────

describe("createBatchSend — coverage gate honours variable mappings", () => {
  it("blocks without a mapping and reaches the API with one", async () => {
    // createBatchSend is the "Send" button's path when the wizard was never
    // saved as a draft. It builds its own preflight payload, so it can drop
    // variableMappings independently of promoteDraftToSend.
    const orgId = `preflight-direct-org-${RUN_ID}`;
    const contactId = `preflight-direct-contact-${RUN_ID}`;
    const memberId = `preflight-direct-member-${RUN_ID}`;
    const awsId = `preflight-direct-aws-${RUN_ID}`;
    const subId = `sub_preflight_direct_${RUN_ID}`;

    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";

    // Reject the enqueue with a distinctive error. Passing the coverage gate
    // is then observable as "got the API's error, not the variable error",
    // without needing the downstream row/tracking machinery to succeed.
    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (...args: Parameters<typeof fetch>) => {
        const [url] = args;
        const asString = typeof url === "string" ? url : url.toString();
        if (asString.endsWith("/v1/batch")) {
          return new Response(JSON.stringify({ error: "enqueue-refused" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return realFetch(...args);
      });

    await db
      .insert(organization)
      .values({
        id: orgId,
        name: "Direct Send Org",
        slug: `direct-send-org-${RUN_ID}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(organizationExtension)
      .values({ organizationId: orgId })
      .onConflictDoNothing();

    await db
      .insert(subscription)
      .values({
        id: subId,
        plan: "growth",
        referenceId: orgId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(member)
      .values({
        id: memberId,
        organizationId: orgId,
        userId: testUser.id,
        role: "owner" as const,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: awsId,
        organizationId: orgId,
        externalId: `direct-send-ext-${RUN_ID}`,
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values({
        id: contactId,
        organizationId: orgId,
        email: `direct-send-${RUN_ID}@example.com`,
        emailHash: `hash-direct-send-${RUN_ID}`,
        emailStatus: "active" as const,
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    const directTemplate = {
      id: `preflight-direct-tmpl-${RUN_ID}`,
      organizationId: orgId,
      name: "Direct Send Template",
      subject: "What's new",
      content: {},
      sourceFormat: "react-email" as const,
      variables: [{ name: "changelogLink", fallback: undefined }],
      status: "PUBLISHED" as const,
      type: "EMAIL" as const,
      sesTemplateName: `wraps-direct-send-${RUN_ID}`,
      publishedAt: new Date("2026-01-01"),
      createdAt: new Date(),
      updatedAt: new Date("2025-12-01"),
      createdBy: testUser.id,
    };

    await db.insert(template).values(directTemplate).onConflictDoNothing();

    const payload = {
      awsAccountId: awsId,
      templateId: directTemplate.id,
      from: "sender@example.com",
      subject: "What's new",
      recipientFilter: { audienceType: "all" as const },
    };

    try {
      // Control: no mapping, no contact property, no fallback → blocked
      // before the API is ever called.
      const blocked = await createBatchSend(orgId, payload);
      expect(blocked.success).toBe(false);
      if (blocked.success) return;
      expect(blocked.error).toContain("changelogLink");
      expect(fetchSpy).not.toHaveBeenCalled();

      // Same send with a static mapping clears the gate and hands off.
      const sent = await createBatchSend(orgId, {
        ...payload,
        variableMappings: [
          {
            variableName: "changelogLink",
            source: { type: "static", value: "https://torbox.cooking" },
          },
        ],
      });

      expect(sent.success).toBe(false);
      if (sent.success) return;
      expect(sent.error).toContain("enqueue-refused");
      expect(sent.error).not.toContain("changelogLink");

      const enqueue = fetchSpy.mock.calls.find(([url]) =>
        String(url).endsWith("/v1/batch")
      );
      expect(enqueue).toBeDefined();
      const body = JSON.parse(String(enqueue?.[1]?.body)) as {
        variableMappings?: { variableName: string }[];
      };
      expect(body.variableMappings?.[0]?.variableName).toBe("changelogLink");
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db.delete(batchSend).where(eq(batchSend.organizationId, orgId));
      await db.delete(template).where(eq(template.id, directTemplate.id));
      await db.delete(contact).where(eq(contact.id, contactId));
      await db.delete(awsAccount).where(eq(awsAccount.id, awsId));
      await db.delete(member).where(eq(member.id, memberId));
      await db.delete(subscription).where(eq(subscription.id, subId));
      await db
        .delete(organizationExtension)
        .where(eq(organizationExtension.organizationId, orgId));
      await db.delete(organization).where(eq(organization.id, orgId));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Daily quota reserve preflight — blocks/allows sends based on SES
// Max24HourSend/SentLast24Hours vs. the account's dailyQuotaReserve.
// ─────────────────────────────────────────────────────────────────────────────

function mockSendApiSuccess() {
  const realFetch = globalThis.fetch.bind(globalThis);
  return vi
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
}

describe("promoteDraftToSend — daily quota reserve preflight", () => {
  it("allows the send with a warning when today's headroom is exhausted but the audience still fits a day's capacity", async () => {
    // The worker pauses and re-enqueues chunks that would touch the reserve,
    // so a send with no headroom RIGHT NOW still drains as the rolling 24h
    // window frees up. It must not be blocked up front.
    const quotaAwsId = `preflight-quota-warn-aws-${RUN_ID}`;
    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: quotaAwsId,
        externalId: `quota-warn-ext-${RUN_ID}`,
        dailyQuotaReserve: 40_000,
      })
      .onConflictDoNothing();

    // Capacity = 120,000 − 40,000 = 80,000 (audience of 2 fits easily), but
    // headroom = 120,000 − 115,000 − 40,000 is negative.
    sesGetAccountQuota = { Max24HourSend: 120_000, SentLast24Hours: 115_000 };
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: quotaAwsId,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "Quota Warn Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      // Warning explains the pause using quota, usage, and reserve.
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("120,000");
      expect(result.warning).toContain("115,000");
      expect(result.warning).toContain("40,000");
      expect(result.warning).toMatch(/resumes automatically/i);
      // Nothing sendable right now, so the warning reports 0.
      expect(result.warning).toMatch(/^Only 0 of 2 emails/);

      // The preflight handed the send off to the API instead of blocking it.
      expect(
        fetchSpy.mock.calls.some(([url]) =>
          String(url).includes(`/v1/batch/${draft.batch.id}/send`)
        )
      ).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
      await db.delete(awsAccount).where(eq(awsAccount.id, quotaAwsId));
    }
  });

  it("omits the warning on a scheduled send, where current usage is not predictive", async () => {
    const quotaAwsId = `preflight-quota-sched-aws-${RUN_ID}`;
    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: quotaAwsId,
        externalId: `quota-sched-ext-${RUN_ID}`,
        dailyQuotaReserve: 40_000,
      })
      .onConflictDoNothing();

    // Same exhausted-headroom numbers that warn on an immediate send.
    sesGetAccountQuota = { Max24HourSend: 120_000, SentLast24Hours: 115_000 };
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: quotaAwsId,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "Quota Scheduled Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        { scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.warning).toBeUndefined();
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
      await db.delete(awsAccount).where(eq(awsAccount.id, quotaAwsId));
    }
  });

  it("returns no warning when the audience fits inside current headroom", async () => {
    const quotaAwsId = `preflight-quota-clean-aws-${RUN_ID}`;
    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: quotaAwsId,
        externalId: `quota-clean-ext-${RUN_ID}`,
        dailyQuotaReserve: 40_000,
      })
      .onConflictDoNothing();

    // headroom = 120,000 − 1,000 − 40,000 = 79,000, well above 2 recipients.
    sesGetAccountQuota = { Max24HourSend: 120_000, SentLast24Hours: 1000 };
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: quotaAwsId,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "Quota Clean Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.warning).toBeUndefined();
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
      await db.delete(awsAccount).where(eq(awsAccount.id, quotaAwsId));
    }
  });

  it("warns instead of blocking when the audience needs multiple days", async () => {
    const quotaAwsId = `preflight-quota-block-aws-${RUN_ID}`;
    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: quotaAwsId,
        externalId: `quota-block-ext-${RUN_ID}`,
        dailyQuotaReserve: 99,
      })
      .onConflictDoNothing();

    // Capacity = 100 − 99 = 1, below the 2-contact audience. The worker's
    // reserve gate drains this across days as the rolling 24h window frees
    // up, so it must warn — not block — with an estimated duration.
    sesGetAccountQuota = { Max24HourSend: 100, SentLast24Hours: 0 };
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: quotaAwsId,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "Quota Block Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.warning).toBeDefined();
      expect(result.warning).toMatch(/about \d+ days?/);
      expect(result.warning).toMatch(/resumes automatically/i);

      // The preflight handed the send off to the API instead of blocking it.
      expect(
        fetchSpy.mock.calls.some(([url]) =>
          String(url).includes(`/v1/batch/${draft.batch.id}/send`)
        )
      ).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
      await db.delete(awsAccount).where(eq(awsAccount.id, quotaAwsId));
    }
  });

  it("blocks every broadcast when the reserve is at or above the daily quota", async () => {
    const quotaAwsId = `preflight-quota-starved-aws-${RUN_ID}`;
    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: quotaAwsId,
        externalId: `quota-starved-ext-${RUN_ID}`,
        dailyQuotaReserve: 50_000,
      })
      .onConflictDoNothing();

    // Reserve swallows the whole quota — capacity is 0.
    sesGetAccountQuota = { Max24HourSend: 50_000, SentLast24Hours: 0 };

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: quotaAwsId,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "Quota Starved Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/at or above/i);
      expect(result.error).toMatch(/Lower the reserve/i);

      const after = await db.query.batchSend.findFirst({
        where: eq(batchSend.id, draft.batch.id),
      });
      expect(after?.status).toBe("draft");
    } finally {
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
      await db.delete(awsAccount).where(eq(awsAccount.id, quotaAwsId));
    }
  });

  it("consults SES even with no reserve set — the whole quota is the broadcast budget", async () => {
    // testAwsAccount has no dailyQuotaReserve set (null by fixture default).
    // With reserve 0, the whole daily quota IS the broadcast budget, so the
    // preflight must still check it — only the SMS channel skips this now.
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: testAwsAccount.id,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "No Reserve Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(true);
      expect(getOrAssumeRoleMock).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
    }
  });

  it("fails open (send proceeds) when GetAccount rejects", async () => {
    const quotaAwsId = `preflight-quota-failopen-aws-${RUN_ID}`;
    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: quotaAwsId,
        externalId: `quota-failopen-ext-${RUN_ID}`,
        dailyQuotaReserve: 40_000,
      })
      .onConflictDoNothing();

    sesGetAccountShouldThrow = true;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: quotaAwsId,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "Fail Open Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
      await db.delete(awsAccount).where(eq(awsAccount.id, quotaAwsId));
    }
  });

  it("fails open (send proceeds) when GetAccount rejects, even with no reserve set", async () => {
    // testAwsAccount has no dailyQuotaReserve set (null by fixture default).
    // The quota check now runs unconditionally, so this fail-open path must
    // hold at reserve 0 too, not only when a reserve is configured.
    sesGetAccountShouldThrow = true;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: testAwsAccount.id,
        templateId: templateNoCustomVars.id,
        from: "sender@example.com",
        subject: "Fail Open No Reserve Test",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
    }
  });

  // Now the sole guard keeping SMS out of the SES quota-check path — the
  // quota check itself no longer gates on `reserve > 0`.
  it("skips the quota check for SMS channel even when reserve is set", async () => {
    const quotaAwsId = `preflight-quota-sms-aws-${RUN_ID}`;
    const smsContactId = `preflight-quota-sms-contact-${RUN_ID}`;
    await db
      .insert(awsAccount)
      .values({
        ...testAwsAccount,
        id: quotaAwsId,
        externalId: `quota-sms-ext-${RUN_ID}`,
        dailyQuotaReserve: 40_000,
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values({
        id: smsContactId,
        organizationId: testOrganization.id,
        phone: "+15005550006",
        phoneHash: `hash-sms-${RUN_ID}`,
        smsStatus: "opted_in",
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Even though the account has a reserve set, an SES GetAccount call
    // would fail this test if made — the SMS channel gate should never
    // reach it. Configure it to throw so any accidental call is caught.
    sesGetAccountShouldThrow = true;

    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    const fetchSpy = mockSendApiSuccess();

    try {
      const draft = await saveDraftBatchSend(testOrganization.id, {
        awsAccountId: quotaAwsId,
        channel: "sms",
        senderId: "wraps",
        body: "Test SMS body",
      });
      expect(draft.success).toBe(true);
      if (!draft.success) return;

      const result = await promoteDraftToSend(
        draft.batch.id,
        testOrganization.id,
        {}
      );

      expect(result.success).toBe(true);
      expect(getOrAssumeRoleMock).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      delete process.env.NEXT_PUBLIC_API_URL;
      await db
        .delete(batchSend)
        .where(eq(batchSend.organizationId, testOrganization.id));
      await db.delete(contact).where(eq(contact.id, smsContactId));
      await db.delete(awsAccount).where(eq(awsAccount.id, quotaAwsId));
    }
  });
});
