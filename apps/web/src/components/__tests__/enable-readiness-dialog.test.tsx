/**
 * @vitest-environment jsdom
 */

import type { Workflow } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { buildClientChecks } from "../(ee)/workflow-builder/enable-readiness-dialog";

// Minimal valid workflow stub
function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    organizationId: "org-1",
    name: "Test Workflow",
    awsAccountId: "aws-1",
    defaultFrom: "test@example.com",
    defaultFromName: null,
    defaultSenderId: null,
    status: "draft",
    enabled: false,
    topicId: null,
    trigger: null,
    steps: [],
    transitions: [],
    createdBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: null,
    ...overrides,
  } as unknown as Workflow;
}

describe("buildClientChecks", () => {
  const noValidationErrors = { errors: [] };

  describe("aws_account check", () => {
    it("passes when workflow has an AWS account", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow({ awsAccountId: "aws-123" }),
        workflowState: null,
        nodes: [],
        validationResult: noValidationErrors,
        isDirty: false,
      });
      const check = checks.find((c) => c.id === "aws_account");
      expect(check?.status).toBe("pass");
    });

    it("fails when workflow has no AWS account", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow({ awsAccountId: null }),
        workflowState: null,
        nodes: [],
        validationResult: noValidationErrors,
        isDirty: false,
      });
      const check = checks.find((c) => c.id === "aws_account");
      expect(check?.status).toBe("fail");
      expect(check?.severity).toBe("critical");
    });

    it("prefers workflowState.awsAccountId over workflow.awsAccountId", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow({ awsAccountId: null }),
        workflowState: makeWorkflow({ awsAccountId: "aws-from-state" }),
        nodes: [],
        validationResult: noValidationErrors,
        isDirty: false,
      });
      expect(checks.find((c) => c.id === "aws_account")?.status).toBe("pass");
    });
  });

  describe("sender_configured check", () => {
    const emailNode = {
      id: "n1",
      type: "workflow-step",
      position: { x: 0, y: 0 },
      data: {
        type: "send_email",
        config: { type: "send_email" },
        cascadeChannels: undefined,
      },
    } as Parameters<typeof buildClientChecks>[0]["nodes"][number];

    it("is not added when there are no email steps", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow({ defaultFrom: null }),
        workflowState: null,
        nodes: [],
        validationResult: noValidationErrors,
        isDirty: false,
      });
      expect(checks.find((c) => c.id === "sender_configured")).toBeUndefined();
    });

    it("passes when email steps exist and defaultFrom is configured", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow({ defaultFrom: "hello@example.com" }),
        workflowState: null,
        nodes: [emailNode],
        validationResult: noValidationErrors,
        isDirty: false,
      });
      expect(checks.find((c) => c.id === "sender_configured")?.status).toBe(
        "pass"
      );
    });

    it("fails when email steps exist but defaultFrom is missing", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow({ defaultFrom: null }),
        workflowState: null,
        nodes: [emailNode],
        validationResult: noValidationErrors,
        isDirty: false,
      });
      const check = checks.find((c) => c.id === "sender_configured");
      expect(check?.status).toBe("fail");
      expect(check?.severity).toBe("critical");
    });
  });

  describe("structural_validation check", () => {
    it("passes when there are no error-severity validation errors", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow(),
        workflowState: null,
        nodes: [],
        validationResult: { errors: [{ severity: "warning" }] },
        isDirty: false,
      });
      expect(checks.find((c) => c.id === "structural_validation")?.status).toBe(
        "pass"
      );
    });

    it("fails when there are error-severity validation issues", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow(),
        workflowState: null,
        nodes: [],
        validationResult: { errors: [{ severity: "error" }] },
        isDirty: false,
      });
      const check = checks.find((c) => c.id === "structural_validation");
      expect(check?.status).toBe("fail");
      expect(check?.details).toMatch(/1 issue/);
    });

    it("passes when validationResult is null", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow(),
        workflowState: null,
        nodes: [],
        validationResult: null,
        isDirty: false,
      });
      expect(checks.find((c) => c.id === "structural_validation")?.status).toBe(
        "pass"
      );
    });
  });

  describe("changes_saved check", () => {
    it("passes when workflow is not dirty", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow(),
        workflowState: null,
        nodes: [],
        validationResult: noValidationErrors,
        isDirty: false,
      });
      expect(checks.find((c) => c.id === "changes_saved")?.status).toBe("pass");
    });

    it("fails when workflow has unsaved changes", () => {
      const checks = buildClientChecks({
        workflow: makeWorkflow(),
        workflowState: null,
        nodes: [],
        validationResult: noValidationErrors,
        isDirty: true,
      });
      const check = checks.find((c) => c.id === "changes_saved");
      expect(check?.status).toBe("fail");
      expect(check?.severity).toBe("critical");
    });
  });

  it("returns all four base checks for a workflow with no email steps", () => {
    const checks = buildClientChecks({
      workflow: makeWorkflow(),
      workflowState: null,
      nodes: [],
      validationResult: noValidationErrors,
      isDirty: false,
    });
    const ids = checks.map((c) => c.id);
    expect(ids).toContain("aws_account");
    expect(ids).toContain("structural_validation");
    expect(ids).toContain("changes_saved");
    expect(ids).not.toContain("sender_configured");
  });
});
