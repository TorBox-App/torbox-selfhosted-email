import { describe, expect, it } from "vitest";
import { classifyWorkflowError } from "@/lib/(ee)/workflows";

// The EXACT error strings thrown by the workflow step handlers
// (apps/api/src/(ee)/workers/workflow-step-handlers.ts). Classification is
// pinned against these real strings so a reworded throw is caught by drift.
const HANDLER_ERRORS = {
  awsAccountMissing: "AWS account aws-acct-123 not found",
  templateDeleted: "Template tmpl-9 not found",
  templateEmpty: "Template tmpl-9 has no compiled HTML",
  sesPermission:
    "Your IAM role does not have permission to send emails. " +
    "Fix: update your CloudFormation stack to the latest version, " +
    "or run `wraps platform update-role` in the CLI.",
  templateRender:
    "Template rendering failed: Parse error on line 1. Send blocked so the " +
    "recipient does not receive raw {{...}} template syntax — fix the " +
    "template, then retry.",
} as const;

// SES reports rendering failures asynchronously through configuration-set
// events; this is the real wording stored on failed sends (see the Apr 2026
// reengagement-activate-account failures).
const SES_ASYNC_RENDER_ERROR =
  "Rendering failure: Attribute 'IF' is not present in the rendering data.";

describe("classifyWorkflowError", () => {
  it("classifies a missing AWS account error with reconnect remediation", () => {
    const result = classifyWorkflowError(HANDLER_ERRORS.awsAccountMissing);
    expect(result.code).toBe("aws_account_missing");
    expect(result.remediation).toMatch(/Reconnect your AWS account/i);
  });

  it("classifies a deleted template error", () => {
    const result = classifyWorkflowError(HANDLER_ERRORS.templateDeleted);
    expect(result.code).toBe("template_deleted");
    expect(result.remediation).toMatch(/Restore or recreate/i);
  });

  it("classifies a template with no compiled HTML as template_empty", () => {
    const result = classifyWorkflowError(HANDLER_ERRORS.templateEmpty);
    expect(result.code).toBe("template_empty");
    expect(result.remediation).toMatch(/Publish/i);
  });

  it("does NOT classify a 'not found' template as template_empty (pattern order guard)", () => {
    // template_empty is checked before template_deleted; a plain "not found"
    // must still resolve to template_deleted. Swapping the two pattern entries
    // would flip this.
    expect(classifyWorkflowError(HANDLER_ERRORS.templateDeleted).code).not.toBe(
      "template_empty"
    );
  });

  it("classifies the real IAM/SES permission error thrown by the send handler", () => {
    const result = classifyWorkflowError(HANDLER_ERRORS.sesPermission);
    expect(result.code).toBe("ses_permission");
    expect(result.remediation).toMatch(/Check SES send permissions/i);
  });

  it("matches case-insensitively and keeps the specific remediation", () => {
    const result = classifyWorkflowError("aws account xyz NOT FOUND");
    expect(result.code).toBe("aws_account_missing");
    expect(result.remediation).toMatch(/Reconnect your AWS account/i);
  });

  it("classifies the worker's blocked-send render error as template_render", () => {
    const result = classifyWorkflowError(HANDLER_ERRORS.templateRender);
    expect(result.code).toBe("template_render");
    expect(result.remediation).toMatch(/Handlebars syntax|missing variables/i);
  });

  it("classifies SES's async rendering-failure event wording as template_render", () => {
    const result = classifyWorkflowError(SES_ASYNC_RENDER_ERROR);
    expect(result.code).toBe("template_render");
  });

  it("falls back to transient for an unrecognized error", () => {
    const result = classifyWorkflowError("some unrecognized error");
    expect(result.code).toBe("transient");
    expect(result.remediation).toMatch(/safe to retry/i);
  });

  it("treats a missing-MessageId SES contract error as transient (not a permission failure)", () => {
    // This is thrown by the send handler but is genuinely retryable — it must
    // not get swept into ses_permission by an over-broad regex.
    const result = classifyWorkflowError("SES SendEmail returned no MessageId");
    expect(result.code).toBe("transient");
  });
});
