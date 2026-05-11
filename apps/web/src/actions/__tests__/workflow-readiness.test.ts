import {
  db,
  member,
  organization,
  organizationExtension,
  template,
  user,
} from "@wraps/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
      const result = await checkWorkflowReadiness(
        "wf-any",
        testOrganization.id,
        { templateIds: [publishedTemplate.id], conditionFields: [] }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_exist");
      expect(check?.status).toBe("pass");
    });

    it("fails templates_exist when a template ID does not exist", async () => {
      const result = await checkWorkflowReadiness(
        "wf-any",
        testOrganization.id,
        { templateIds: ["non-existent-template-id"], conditionFields: [] }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_exist");
      expect(check?.status).toBe("fail");
      expect(check?.details).toMatch(/1 template not found/);
    });

    it("warns templates_published when a template is not published", async () => {
      const result = await checkWorkflowReadiness(
        "wf-any",
        testOrganization.id,
        { templateIds: [draftTemplate.id], conditionFields: [] }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_published");
      expect(check?.status).toBe("fail");
      expect(check?.severity).toBe("warning");
    });

    it("passes templates_published when all templates are published", async () => {
      const result = await checkWorkflowReadiness(
        "wf-any",
        testOrganization.id,
        { templateIds: [publishedTemplate.id], conditionFields: [] }
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const check = result.checks.find((c) => c.id === "templates_published");
      expect(check?.status).toBe("pass");
    });

    it("does not expose templates from a different organization (IDOR guard)", async () => {
      // publishedTemplate belongs to testOrganization. Query with a different
      // org ID — the template should appear as "not found" even though its ID is valid.
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
        .insert(user)
        .values(testUser)
        .onConflictDoUpdate({
          target: user.id,
          set: { updatedAt: new Date() },
        });
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

      const result = await checkWorkflowReadiness("wf-any", differentOrgId, {
        templateIds: [publishedTemplate.id],
        conditionFields: [],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Template belongs to testOrganization, not differentOrgId → not found
      const check = result.checks.find((c) => c.id === "templates_exist");
      expect(check?.status).toBe("fail");
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
