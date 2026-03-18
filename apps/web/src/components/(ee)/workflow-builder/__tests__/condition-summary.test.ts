import type { WorkflowStepConfig } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { getConditionSummary } from "../lib/condition-summary";

describe("getConditionSummary", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 1: Returns condition summary with field, operator, value for "yes" handle
  // ═══════════════════════════════════════════════════════════════════════════

  it('returns condition summary with field, operator, value for "yes" handle', () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "email",
      operator: "equals",
      value: "test@example.com",
    };

    const result = getConditionSummary(config, "yes");

    expect(result).toEqual({
      title: "email equals test@example.com",
      description: "Contacts matching this condition",
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 2: Returns "NOT matching" description for "no" handle
  // ═══════════════════════════════════════════════════════════════════════════

  it('returns "NOT matching" description for "no" handle', () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "status",
      operator: "equals",
      value: "active",
    };

    const result = getConditionSummary(config, "no");

    expect(result).toEqual({
      title: "status equals active",
      description: "Contacts NOT matching this condition",
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 3: Unary operators (is_set) don't show a value
  // ═══════════════════════════════════════════════════════════════════════════

  it("returns summary without value for unary operators", () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "phone",
      operator: "is_set",
      value: "",
    };

    const result = getConditionSummary(config, "yes");

    expect(result).toEqual({
      title: "phone is set",
      description: "Contacts matching this condition",
    });
  });

  it("returns summary without value for is_true operator", () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "verified",
      operator: "is_true",
      value: "",
    };

    const result = getConditionSummary(config, "yes");

    expect(result).toEqual({
      title: "verified is true",
      description: "Contacts matching this condition",
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 4: wait_for_event summary with event name and timeout
  // ═══════════════════════════════════════════════════════════════════════════

  it("returns wait_for_event summary with event name for timeout handle", () => {
    const config: WorkflowStepConfig = {
      type: "wait_for_event",
      eventName: "purchase.completed",
      timeoutSeconds: 86_400,
    };

    const result = getConditionSummary(config, "timeout");

    expect(result).toEqual({
      title: "Wait for: purchase.completed",
      description: "Timeout after 1 days",
    });
  });

  it("returns wait_for_event summary for default handle (event received)", () => {
    const config: WorkflowStepConfig = {
      type: "wait_for_event",
      eventName: "purchase.completed",
      timeoutSeconds: 3600,
    };

    const result = getConditionSummary(config, "default");

    expect(result).toEqual({
      title: "Wait for: purchase.completed",
      description: "Event received",
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 5: wait_for_email_engagement summary with timeout
  // ═══════════════════════════════════════════════════════════════════════════

  it("returns wait_for_email_engagement summary with timeout", () => {
    const config: WorkflowStepConfig = {
      type: "wait_for_email_engagement",
      timeoutSeconds: 172_800,
    };

    const result = getConditionSummary(config, "timeout");

    expect(result).toEqual({
      title: "Wait for email engagement",
      description: "Timeout after 2 days",
    });
  });

  it("returns wait_for_email_engagement summary for default handle", () => {
    const config: WorkflowStepConfig = {
      type: "wait_for_email_engagement",
      timeoutSeconds: 86_400,
    };

    const result = getConditionSummary(config, "default");

    expect(result).toEqual({
      title: "Wait for email engagement",
      description: "Engagement detected",
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 6: Returns null for non-branching types
  // ═══════════════════════════════════════════════════════════════════════════

  it("returns null for send_email type", () => {
    const config: WorkflowStepConfig = {
      type: "send_email",
      templateId: "tpl-123",
    };
    expect(getConditionSummary(config, "yes")).toBeNull();
  });

  it("returns null for delay type", () => {
    const config: WorkflowStepConfig = {
      type: "delay",
      amount: 5,
      unit: "hours",
    };
    expect(getConditionSummary(config, null)).toBeNull();
  });

  it("returns null for exit type", () => {
    const config: WorkflowStepConfig = {
      type: "exit",
    };
    expect(getConditionSummary(config, undefined)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 7: Returns null when sourceHandle is null/undefined
  // ═══════════════════════════════════════════════════════════════════════════

  it("returns null when sourceHandle is null", () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "email",
      operator: "equals",
      value: "test@example.com",
    };
    expect(getConditionSummary(config, null)).toBeNull();
  });

  it("returns null when sourceHandle is undefined", () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "email",
      operator: "equals",
      value: "test@example.com",
    };
    expect(getConditionSummary(config, undefined)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 8: Strips UUID prefixes from field names
  // ═══════════════════════════════════════════════════════════════════════════

  it("strips step UUID prefix from field names", () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "steps.a1b2c3d4-e5f6-7890-abcd-ef1234567890.email.opened",
      operator: "equals",
      value: "true",
    };

    const result = getConditionSummary(config, "yes");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("email.opened equals true");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 9: Uses human-readable operator labels
  // ═══════════════════════════════════════════════════════════════════════════

  it("maps all operators to human-readable labels", () => {
    const makeConfig = (operator: string): WorkflowStepConfig => ({
      type: "condition",
      field: "age",
      operator,
      value: "30",
    });

    const expectations: [string, string][] = [
      ["equals", "age equals 30"],
      ["not_equals", "age does not equal 30"],
      ["contains", "age contains 30"],
      ["not_contains", "age does not contain 30"],
      ["starts_with", "age starts with 30"],
      ["ends_with", "age ends with 30"],
      ["greater_than", "age > 30"],
      ["less_than", "age < 30"],
      ["greater_than_or_equals", "age >= 30"],
      ["less_than_or_equals", "age <= 30"],
    ];

    for (const [operator, expectedTitle] of expectations) {
      const result = getConditionSummary(makeConfig(operator), "yes");
      expect(result).not.toBeNull();
      expect(result!.title).toBe(expectedTitle);
    }

    // Unary operators
    const unaryExpectations: [string, string][] = [
      ["is_set", "age is set"],
      ["is_not_set", "age is not set"],
      ["is_true", "age is true"],
      ["is_false", "age is false"],
    ];

    for (const [operator, expectedTitle] of unaryExpectations) {
      const result = getConditionSummary(makeConfig(operator), "yes");
      expect(result).not.toBeNull();
      expect(result!.title).toBe(expectedTitle);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit 10: Handles missing/empty field gracefully
  // ═══════════════════════════════════════════════════════════════════════════

  it("returns null when condition field is empty string", () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "",
      operator: "equals",
      value: "test",
    };
    expect(getConditionSummary(config, "yes")).toBeNull();
  });

  it("falls back to raw operator when unknown operator is used", () => {
    const config: WorkflowStepConfig = {
      type: "condition",
      field: "status",
      operator: "custom_op",
      value: "active",
    };

    const result = getConditionSummary(config, "yes");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("status custom_op active");
  });
});
