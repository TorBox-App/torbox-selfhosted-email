import {
  db,
  member,
  organization,
  organizationExtension,
  template,
  user,
  workflow,
} from "@wraps/db";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { checkWorkflowReadiness } from "../(ee)/workflow-readiness";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const testUser = {
  id: "test-readiness-user-1",
  email: "readiness-test@example.com",
  name: "Readiness Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-readiness-org-1",
  name: "Readiness Test Org",
  slug: "readiness-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testOwnerMember = {
  id: "test-readiness-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const publishedTemplate = {
  id: "test-readiness-tpl-published",
  organizationId: testOrganization.id,
  name: "Published Template",
  status: "PUBLISHED" as const,
  content: {} as Record<string, unknown>,
  source: null,
  compiledHtml: null,
  subject: "Hello",
  previewText: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
  lastPublishedAt: new Date(),
  sesTemplateName: "test-readiness-tpl-published",
};

const draftTemplate = {
  id: "test-readiness-tpl-draft",
  organizationId: testOrganization.id,
  name: "Draft Template",
  status: "DRAFT" as const,
  content: {} as Record<string, unknown>,
  source: null,
  compiledHtml: null,
  subject: "Hello",
  previewText: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
  lastPublishedAt: null,
  sesTemplateName: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth mocks
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
          id: "session-readiness",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      })),
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
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
    .insert(member)
    .values(testOwnerMember)
    .onConflictDoUpdate({ target: member.id, set: { role: "owner" } });

  await db
    .insert(template)
    .values([publishedTemplate, draftTemplate])
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(template)
    .where(inArray(template.id, [publishedTemplate.id, draftTemplate.id]));
  await db
    .delete(member)
    .where(
      inArray(member.id, [testOwnerMember.id, "test-readiness-other-member"])
    );
  await db
    .delete(organization)
    .where(
      inArray(organization.id, [testOrganization.id, "test-readiness-org-2"])
    );
  await db.delete(user).where(eq(user.id, testUser.id));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("checkWorkflowReadiness", () => {
  // Template IDs are derived from the workflow's send_email steps in the DB
  // (Issue #16 — never from the client payload). Tests must seed a real workflow
  // with the templates wired into its steps.
  const createdWorkflowIds: string[] = [];

  async function seedWorkflowWithTemplates(
    workflowOrgId: string,
    templateIds: string[]
  ): Promise<string> {
    const [wf] = await db
      .insert(workflow)
      .values({
        organizationId: workflowOrgId,
        name: "Readiness Template Test",
        status: "draft",
        triggerType: "event",
        triggerConfig: {},
        steps: [
          {
            id: "trigger-step",
            type: "trigger",
            name: "Trigger",
            position: { x: 0, y: 0 },
            config: { type: "trigger", triggerType: "event" },
          },
          ...templateIds.map((tid, i) => ({
            id: `email-step-${i}`,
            type: "send_email" as const,
            name: "Send Email",
            position: { x: 0, y: 200 + i * 100 },
            config: { type: "send_email" as const, templateId: tid },
          })),
        ],
        transitions: [],
        createdBy: testUser.id,
      })
      .returning();
    createdWorkflowIds.push(wf!.id);
    return wf!.id;
  }

  afterEach(async () => {
    if (createdWorkflowIds.length > 0) {
      await db.delete(workflow).where(inArray(workflow.id, createdWorkflowIds));
      createdWorkflowIds.length = 0;
    }
  });

  it("returns success with empty checks when payload has no template IDs or fields", async () => {
    const result = await checkWorkflowReadiness("wf-any", testOrganization.id, {
      templateIds: [],
      conditionFields: [],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.checks).toHaveLength(0);
  });

  it("returns access error for unknown organization", async () => {
    const result = await checkWorkflowReadiness(
      "wf-any",
      "non-existent-org-id",
      { templateIds: [], conditionFields: [] }
    );

    expect(result.success).toBe(false);
  });

  describe("template checks", () => {
    it("passes templates_exist when all template IDs are found", async () => {
      const wfId = await seedWorkflowWithTemplates(testOrganization.id, [
        publishedTemplate.id,
      ]);

      const result = await checkWorkflowReadiness(wfId, testOrganization.id, {
        templateIds: [],
        conditionFields: [],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_exist");
      expect(check?.status).toBe("pass");
    });

    it("fails templates_exist when a template ID does not exist", async () => {
      const wfId = await seedWorkflowWithTemplates(testOrganization.id, [
        "non-existent-template-id",
      ]);

      const result = await checkWorkflowReadiness(wfId, testOrganization.id, {
        templateIds: [],
        conditionFields: [],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_exist");
      expect(check?.status).toBe("fail");
      expect(check?.details).toMatch(/1 template not found/);
    });

    it("warns templates_published when a template is not published", async () => {
      const wfId = await seedWorkflowWithTemplates(testOrganization.id, [
        draftTemplate.id,
      ]);

      const result = await checkWorkflowReadiness(wfId, testOrganization.id, {
        templateIds: [],
        conditionFields: [],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_published");
      expect(check?.status).toBe("fail");
      expect(check?.severity).toBe("warning");
    });

    it("passes templates_published when all templates are published", async () => {
      const wfId = await seedWorkflowWithTemplates(testOrganization.id, [
        publishedTemplate.id,
      ]);

      const result = await checkWorkflowReadiness(wfId, testOrganization.id, {
        templateIds: [],
        conditionFields: [],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_published");
      expect(check?.status).toBe("pass");
    });

    it("does not expose templates from a different organization (IDOR guard)", async () => {
      // publishedTemplate belongs to testOrganization. A workflow in a DIFFERENT
      // org references it via a send_email step — the template must appear as
      // "not found" because checkTemplates scopes the lookup to differentOrgId.
      const differentOrgId = "test-readiness-org-2";
      await db
        .insert(organization)
        .values({
          id: differentOrgId,
          name: "Other Org",
          slug: "other-org",
          createdAt: new Date(),
          logo: null,
          metadata: null,
        })
        .onConflictDoNothing();
      await db
        .insert(member)
        .values({
          id: "test-readiness-other-member",
          organizationId: differentOrgId,
          userId: testUser.id,
          role: "owner" as const,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
      await db
        .insert(organizationExtension)
        .values({ organizationId: differentOrgId })
        .onConflictDoNothing();

      const wfId = await seedWorkflowWithTemplates(differentOrgId, [
        publishedTemplate.id,
      ]);

      const result = await checkWorkflowReadiness(wfId, differentOrgId, {
        templateIds: [],
        conditionFields: [],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Template belongs to testOrganization, not differentOrgId → not found
      const check = result.checks.find((c) => c.id === "templates_exist");
      expect(check?.status).toBe("fail");
    });
  });

  // ─── Unit 22: Template IDs derived from DB, not client payload ────────────
  describe("template ID derivation from DB (Issue #16)", () => {
    it("ignores client-supplied templateIds and uses template IDs from workflow steps in DB", async () => {
      // Create a workflow with a send_email step referencing publishedTemplate
      const [wf] = await db
        .insert(workflow)
        .values({
          organizationId: testOrganization.id,
          name: "Readiness DB Derivation Test",
          status: "draft",
          triggerType: "event",
          triggerConfig: {},
          steps: [
            {
              id: "trigger-step",
              type: "trigger",
              name: "Trigger",
              position: { x: 0, y: 0 },
              config: { type: "trigger", triggerType: "event" },
            },
            {
              id: "email-step",
              type: "send_email",
              name: "Send Email",
              position: { x: 0, y: 200 },
              config: {
                type: "send_email",
                templateId: publishedTemplate.id,
              },
            },
          ],
          transitions: [],
          createdBy: testUser.id,
        })
        .returning();

      try {
        // Client supplies a DIFFERENT (non-existent) template ID in payload
        // If derivation works from DB, this client-supplied ID should be IGNORED
        const result = await checkWorkflowReadiness(
          wf!.id,
          testOrganization.id,
          {
            templateIds: ["client-spoofed-fake-template-id"],
            conditionFields: [],
          }
        );

        expect(result.success).toBe(true);
        if (!result.success) return;

        // templates_exist check should PASS because the DB-derived template exists
        // (not fail because the client-supplied fake ID doesn't exist)
        const existCheck = result.checks.find(
          (c) => c.id === "templates_exist"
        );
        expect(existCheck?.status).toBe("pass");
      } finally {
        await db.delete(workflow).where(eq(workflow.id, wf!.id));
      }
    });
  });

  describe("condition field checks", () => {
    it("passes for known contact fields", async () => {
      const result = await checkWorkflowReadiness(
        "wf-any",
        testOrganization.id,
        { templateIds: [], conditionFields: ["email", "firstName", "status"] }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find(
        (c) => c.id === "condition_fields_valid"
      );
      expect(check?.status).toBe("pass");
    });

    it("passes for custom properties.* fields", async () => {
      const result = await checkWorkflowReadiness(
        "wf-any",
        testOrganization.id,
        { templateIds: [], conditionFields: ["properties.customAttr"] }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find(
        (c) => c.id === "condition_fields_valid"
      );
      expect(check?.status).toBe("pass");
    });

    it("warns on unknown condition fields", async () => {
      const result = await checkWorkflowReadiness(
        "wf-any",
        testOrganization.id,
        { templateIds: [], conditionFields: ["unknownField"] }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find(
        (c) => c.id === "condition_fields_valid"
      );
      expect(check?.status).toBe("fail");
      expect(check?.severity).toBe("warning");
      expect(check?.details).toContain("unknownField");
    });
  });
});
