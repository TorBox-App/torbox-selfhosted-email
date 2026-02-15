/**
 * Cascade Integration Tests
 *
 * Verifies that cascade-shaped workflow definitions pass through
 * the full transform → validate pipeline without errors.
 *
 * These tests construct step definitions matching what `cascade()` from
 * `@wraps.dev/client` produces, then run them through `transformWorkflow()`
 * and `validateTransformedWorkflow()`.
 */

import { describe, expect, it } from "vitest";
import {
  type StepDefinition,
  transformWorkflow,
  type WorkflowDefinition,
} from "../workflow-transform.js";
import { validateTransformedWorkflow } from "../workflow-validator.js";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — mirror cascade() output shapes
// ═══════════════════════════════════════════════════════════════════════════

function cascadeSendEmail(
  id: string,
  template: string,
  extra?: Record<string, unknown>
): StepDefinition {
  return {
    id,
    type: "send_email",
    name: `Cascade: send ${template}`,
    config: { type: "send_email", template, ...extra },
  };
}

function cascadeWaitForEngagement(
  id: string,
  timeoutSeconds: number
): StepDefinition {
  return {
    id,
    type: "wait_for_email_engagement",
    name: "Cascade: wait for opened",
    config: { type: "wait_for_email_engagement", timeoutSeconds },
  };
}

function cascadeCondition(
  id: string,
  waitStepId: string,
  exitId: string
): StepDefinition {
  return {
    id,
    type: "condition",
    name: "Cascade: email engaged?",
    config: {
      type: "condition",
      field: "engagement.status",
      operator: "equals",
      value: true,
    },
    branches: {
      yes: [
        {
          id: exitId,
          type: "exit",
          name: "Exit",
          config: { type: "exit", reason: "Engaged via email" },
        },
      ],
    },
  };
}

function cascadeSendSms(
  id: string,
  template: string,
  extra?: Record<string, unknown>
): StepDefinition {
  return {
    id,
    type: "send_sms",
    name: `Cascade: send ${template}`,
    config: { type: "send_sms", template, ...extra },
  };
}

function cascadeDelay(
  id: string,
  amount: number,
  unit: string
): StepDefinition {
  return {
    id,
    type: "delay",
    name: "Cascade: wait before next channel",
    config: { type: "delay", amount, unit },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("cascade integration — transform + validate", () => {
  it("2-channel cascade (email → sms) passes full pipeline", () => {
    // Matches cascade('notify', { channels: [
    //   { type: 'email', template: 'recovery', waitFor: { hours: 2 }, engagement: 'opened' },
    //   { type: 'sms', template: 'recovery-sms' },
    // ]})
    const definition: WorkflowDefinition = {
      name: "Cart Recovery Cascade",
      trigger: { type: "event", eventName: "cart.abandoned" },
      steps: [
        cascadeSendEmail("notify-email", "recovery"),
        cascadeWaitForEngagement("notify-email-wait", 7200),
        cascadeCondition(
          "notify-email-check",
          "notify-email-wait",
          "notify-engaged"
        ),
        cascadeSendSms("notify-sms-1", "recovery-sms"),
      ],
    };

    const transformed = transformWorkflow(definition);
    const result = validateTransformedWorkflow(transformed);

    // Should pass with zero errors
    const errors = result.errors.filter((e) => e.severity === "error");
    expect(errors).toHaveLength(0);
    expect(result.isValid).toBe(true);

    // Verify structure: trigger + 4 cascade steps + exit (inside branch) = 6
    expect(transformed.steps).toHaveLength(6);

    // Verify the exit step was flattened from the condition's yes branch
    const exitStep = transformed.steps.find((s) => s.id === "notify-engaged");
    expect(exitStep).toBeDefined();
    expect(exitStep?.type).toBe("exit");

    // Verify transitions connect correctly
    const condToExit = transformed.transitions.find(
      (t) =>
        t.fromStepId === "notify-email-check" && t.toStepId === "notify-engaged"
    );
    expect(condToExit?.condition).toEqual({ branch: "yes" });

    // SMS should be reachable from condition (fallthrough for empty no branch)
    const condToSms = transformed.transitions.find(
      (t) =>
        t.fromStepId === "notify-email-check" && t.toStepId === "notify-sms-1"
    );
    expect(condToSms).toBeDefined();
    expect(condToSms?.condition).toBeUndefined(); // No branch condition = fallthrough
  });

  it("single-channel cascade (just send) passes full pipeline", () => {
    // Matches cascade('simple', { channels: [{ type: 'email', template: 'notification' }] })
    const definition: WorkflowDefinition = {
      name: "Simple Notification",
      trigger: { type: "contact_created" },
      steps: [cascadeSendEmail("simple-email", "notification")],
    };

    const transformed = transformWorkflow(definition);
    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
    // trigger + 1 email = 2 steps
    expect(transformed.steps).toHaveLength(2);
  });

  it("3-channel cascade (email → sms → email) passes full pipeline", () => {
    // Matches cascade('multi', { channels: [
    //   { type: 'email', template: 'email-1', waitFor: { hours: 2 }, engagement: 'opened' },
    //   { type: 'sms', template: 'sms-1', waitFor: { hours: 4 } },
    //   { type: 'email', template: 'email-2' },
    // ]})
    const definition: WorkflowDefinition = {
      name: "Multi-Channel Cascade",
      trigger: { type: "event", eventName: "signup" },
      steps: [
        // Channel 1: email with engagement check
        cascadeSendEmail("multi-email", "email-1"),
        cascadeWaitForEngagement("multi-email-wait", 7200),
        cascadeCondition(
          "multi-email-check",
          "multi-email-wait",
          "multi-engaged"
        ),
        // Channel 2: sms with delay before next
        cascadeSendSms("multi-sms-1", "sms-1"),
        cascadeDelay("multi-sms-1-wait", 4, "hours"),
        // Channel 3: final email (no wait/check)
        cascadeSendEmail("multi-email-2", "email-2"),
      ],
    };

    const transformed = transformWorkflow(definition);
    const result = validateTransformedWorkflow(transformed);

    const errors = result.errors.filter((e) => e.severity === "error");
    expect(errors).toHaveLength(0);
    expect(result.isValid).toBe(true);

    // trigger + 6 cascade steps + exit = 8
    expect(transformed.steps).toHaveLength(8);
  });

  it("cascade with extra email config passes validation", () => {
    const definition: WorkflowDefinition = {
      name: "Branded Cascade",
      trigger: { type: "contact_created" },
      steps: [
        cascadeSendEmail("branded-email", "branded", {
          from: "hello@example.com",
          fromName: "Hello Team",
          subject: "Custom Subject",
        }),
        cascadeWaitForEngagement("branded-email-wait", 14_400),
        cascadeCondition(
          "branded-email-check",
          "branded-email-wait",
          "branded-engaged"
        ),
        cascadeSendSms("branded-sms-1", "branded-sms", { senderId: "MYAPP" }),
      ],
    };

    const transformed = transformWorkflow(definition);
    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);

    // Verify extra config was preserved through transform
    const emailStep = transformed.steps.find((s) => s.id === "branded-email");
    expect(emailStep?.config).toMatchObject({
      type: "send_email",
      template: "branded",
      from: "hello@example.com",
    });
  });

  it("cascade mixed with regular workflow steps passes validation", () => {
    // Real-world pattern: delay → cascade → exit
    const definition: WorkflowDefinition = {
      name: "Cart Recovery with Delay",
      trigger: { type: "event", eventName: "cart.abandoned" },
      steps: [
        // Regular delay before cascade
        {
          id: "initial-wait",
          type: "delay",
          name: "Wait 30 minutes",
          config: { type: "delay", amount: 30, unit: "minutes" },
        },
        // Cascade steps
        cascadeSendEmail("recover-email", "cart-recovery"),
        cascadeWaitForEngagement("recover-email-wait", 7200),
        cascadeCondition(
          "recover-email-check",
          "recover-email-wait",
          "recover-engaged"
        ),
        cascadeSendSms("recover-sms-1", "cart-sms-reminder"),
        // Regular exit after cascade
        {
          id: "cascade-complete",
          type: "exit",
          name: "Exit",
          config: { type: "exit", reason: "All channels tried" },
        },
      ],
    };

    const transformed = transformWorkflow(definition);
    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);

    // All steps should be reachable (no orphan warnings)
    const orphanWarnings = result.errors.filter(
      (e) => e.severity === "warning" && e.message.includes("not connected")
    );
    expect(orphanWarnings).toHaveLength(0);
  });
});
