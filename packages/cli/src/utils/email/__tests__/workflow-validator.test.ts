/**
 * Workflow Validator Tests
 *
 * Tests validation of transformed workflows for the CLI.
 */

import { describe, expect, it } from "vitest";
import type {
  TransformedWorkflow,
  WorkflowStep,
  WorkflowTransition,
} from "../workflow-transform.js";
import {
  type ValidationError,
  validateTransformedWorkflow,
} from "../workflow-validator.js";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createTransformed(
  overrides: Partial<TransformedWorkflow> = {}
): TransformedWorkflow {
  return {
    steps: [
      {
        id: "trigger",
        type: "trigger",
        name: "Trigger",
        position: { x: 0, y: 0 },
        config: { type: "trigger", triggerType: "contact_created" },
      },
    ],
    transitions: [],
    triggerType: "contact_created",
    triggerConfig: {},
    ...overrides,
  };
}

function triggerStep(triggerType = "contact_created"): WorkflowStep {
  return {
    id: "trigger",
    type: "trigger",
    name: "Trigger",
    position: { x: 0, y: 0 },
    config: { type: "trigger", triggerType },
  };
}

function sendEmailStep(id: string, template?: string): WorkflowStep {
  return {
    id,
    type: "send_email",
    name: `Send ${template || "email"}`,
    position: { x: 0, y: 200 },
    config: { type: "send_email", template, templateId: template },
  };
}

function delayStep(id: string, amount = 1): WorkflowStep {
  return {
    id,
    type: "delay",
    name: `Wait ${amount} days`,
    position: { x: 0, y: 200 },
    config: { type: "delay", amount, unit: "days" },
  };
}

function _conditionStep(id: string): WorkflowStep {
  return {
    id,
    type: "condition",
    name: "Check condition",
    position: { x: 0, y: 200 },
    config: {
      type: "condition",
      field: "contact.active",
      operator: "equals",
      value: true,
    },
  };
}

function webhookStep(id: string, url?: string): WorkflowStep {
  return {
    id,
    type: "webhook",
    name: "Webhook",
    position: { x: 0, y: 200 },
    config: { type: "webhook", url },
  };
}

function waitForEventStep(id: string, eventName?: string): WorkflowStep {
  return {
    id,
    type: "wait_for_event",
    name: "Wait for event",
    position: { x: 0, y: 200 },
    config: { type: "wait_for_event", eventName },
  };
}

function topicStep(
  id: string,
  type: "subscribe_topic" | "unsubscribe_topic",
  topicId?: string
): WorkflowStep {
  return {
    id,
    type,
    name: type === "subscribe_topic" ? "Subscribe" : "Unsubscribe",
    position: { x: 0, y: 200 },
    config: { type, topicId },
  };
}

function _exitStep(id: string): WorkflowStep {
  return {
    id,
    type: "exit",
    name: "Exit",
    position: { x: 0, y: 200 },
    config: { type: "exit" },
  };
}

function transition(
  from: string,
  to: string,
  branch?: "yes" | "no"
): WorkflowTransition {
  return {
    id: `t-${from}-${to}`,
    fromStepId: from,
    toStepId: to,
    ...(branch ? { condition: { branch } } : {}),
  };
}

function getError(
  errors: ValidationError[],
  field?: string
): ValidationError | undefined {
  return errors.find((e) => e.field === field || !(field || e.field));
}

function getErrorByNodeId(
  errors: ValidationError[],
  nodeId: string
): ValidationError | undefined {
  return errors.find((e) => e.nodeId === nodeId);
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Structure", () => {
  it("should pass for valid minimal workflow", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), sendEmailStep("email-1", "welcome")],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
    expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });

  it("should require exactly one trigger", () => {
    const noTrigger = createTransformed({
      steps: [sendEmailStep("email-1", "welcome")],
    });

    const result = validateTransformedWorkflow(noTrigger);

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes("must have a trigger"))
    ).toBe(true);
  });

  it("should reject multiple triggers", () => {
    const twoTriggers = createTransformed({
      steps: [
        triggerStep("contact_created"),
        { ...triggerStep("event"), id: "trigger-2" },
        sendEmailStep("email-1", "welcome"),
      ],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(twoTriggers);

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes("only have one trigger"))
    ).toBe(true);
  });

  it("should warn about orphan nodes", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        sendEmailStep("email-1", "welcome"),
        sendEmailStep("orphan", "orphan"), // Not connected
      ],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    // Orphan is a warning, not an error
    expect(result.isValid).toBe(true);
    const orphanWarning = result.errors.find(
      (e) => e.nodeId === "orphan" && e.severity === "warning"
    );
    expect(orphanWarning).toBeDefined();
    expect(orphanWarning?.message).toContain("not connected");
  });

  it("should detect invalid transition references", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), sendEmailStep("email-1", "welcome")],
      transitions: [
        transition("trigger", "email-1"),
        transition("email-1", "nonexistent"), // Invalid target
      ],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes("non-existent target"))
    ).toBe(true);
  });

  it("should detect invalid source step in transition", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), sendEmailStep("email-1", "welcome")],
      transitions: [
        transition("nonexistent", "email-1"), // Invalid source
      ],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes("non-existent source"))
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Trigger Step", () => {
  it("should require eventName for event trigger", () => {
    const transformed = createTransformed({
      steps: [
        {
          ...triggerStep(),
          config: { type: "trigger", triggerType: "event" }, // Missing eventName
        },
      ],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getError(result.errors, "eventName");
    expect(error?.message).toContain("Event name is required");
  });

  it("should require segmentId for segment_entry trigger", () => {
    const transformed = createTransformed({
      steps: [
        {
          ...triggerStep(),
          config: { type: "trigger", triggerType: "segment_entry" }, // Missing segmentId
        },
      ],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getError(result.errors, "segmentId");
    expect(error?.message).toContain("Segment is required");
  });

  it("should require topicId for topic_subscribed trigger", () => {
    const transformed = createTransformed({
      steps: [
        {
          ...triggerStep(),
          config: { type: "trigger", triggerType: "topic_subscribed" }, // Missing topicId
        },
      ],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getError(result.errors, "topicId");
    expect(error?.message).toContain("Topic is required");
  });

  it("should require schedule and timezone for schedule trigger", () => {
    const transformed = createTransformed({
      steps: [
        {
          ...triggerStep(),
          config: { type: "trigger", triggerType: "schedule" }, // Missing schedule and timezone
        },
      ],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "schedule")).toBe(true);
    expect(result.errors.some((e) => e.field === "timezone")).toBe(true);
  });

  it("should pass for contact_created trigger (no extra config)", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep("contact_created"),
        sendEmailStep("email-1", "welcome"),
      ],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEND EMAIL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Send Email Step", () => {
  it("should require template or templateId", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        {
          id: "email-1",
          type: "send_email",
          name: "Send email",
          position: { x: 0, y: 200 },
          config: { type: "send_email" }, // Missing template
        },
      ],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "email-1");
    expect(error?.message).toContain("template is required");
  });

  it("should pass with template", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), sendEmailStep("email-1", "welcome")],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELAY VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Delay Step", () => {
  it("should require amount >= 1", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        delayStep("delay-1", 0), // Invalid amount
      ],
      transitions: [transition("trigger", "delay-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "delay-1");
    expect(error?.message).toContain("at least 1");
  });

  it("should pass with valid amount", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), delayStep("delay-1", 3)],
      transitions: [transition("trigger", "delay-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONDITION VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Condition Step", () => {
  it("should require field", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        {
          id: "cond-1",
          type: "condition",
          name: "Check",
          position: { x: 0, y: 200 },
          config: { type: "condition", operator: "equals", value: true }, // Missing field
        },
      ],
      transitions: [transition("trigger", "cond-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getError(result.errors, "field");
    expect(error?.message).toContain("field is required");
  });

  it("should require operator", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        {
          id: "cond-1",
          type: "condition",
          name: "Check",
          position: { x: 0, y: 200 },
          config: { type: "condition", field: "contact.active", value: true }, // Missing operator
        },
      ],
      transitions: [transition("trigger", "cond-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getError(result.errors, "operator");
    expect(error?.message).toContain("operator is required");
  });

  it("should require value for most operators", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        {
          id: "cond-1",
          type: "condition",
          name: "Check",
          position: { x: 0, y: 200 },
          config: {
            type: "condition",
            field: "contact.active",
            operator: "equals",
          }, // Missing value
        },
      ],
      transitions: [transition("trigger", "cond-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getError(result.errors, "value");
    expect(error?.message).toContain("value is required");
  });

  it("should not require value for is_set operator", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        {
          id: "cond-1",
          type: "condition",
          name: "Check",
          position: { x: 0, y: 200 },
          config: {
            type: "condition",
            field: "contact.email",
            operator: "is_set",
          },
        },
      ],
      transitions: [transition("trigger", "cond-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });

  it("should not require value for is_true operator", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        {
          id: "cond-1",
          type: "condition",
          name: "Check",
          position: { x: 0, y: 200 },
          config: {
            type: "condition",
            field: "contact.verified",
            operator: "is_true",
          },
        },
      ],
      transitions: [transition("trigger", "cond-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Webhook Step", () => {
  it("should require url", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), webhookStep("webhook-1")], // Missing URL
      transitions: [transition("trigger", "webhook-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "webhook-1");
    expect(error?.message).toContain("URL is required");
  });

  it("should require valid URL format", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), webhookStep("webhook-1", "not-a-url")],
      transitions: [transition("trigger", "webhook-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "webhook-1");
    expect(error?.message).toContain("Invalid URL");
  });

  it("should pass with valid URL", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        webhookStep("webhook-1", "https://example.com/hook"),
      ],
      transitions: [transition("trigger", "webhook-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WAIT FOR EVENT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Wait For Event Step", () => {
  it("should require eventName", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), waitForEventStep("wait-1")], // Missing eventName
      transitions: [transition("trigger", "wait-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "wait-1");
    expect(error?.message).toContain("Event name is required");
  });

  it("should pass with eventName", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), waitForEventStep("wait-1", "purchase_completed")],
      transitions: [transition("trigger", "wait-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOPIC STEP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Topic Steps", () => {
  it("should require topicId for subscribe_topic", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), topicStep("sub-1", "subscribe_topic")], // Missing topicId
      transitions: [transition("trigger", "sub-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "sub-1");
    expect(error?.message).toContain("Topic is required");
  });

  it("should require topicId for unsubscribe_topic", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), topicStep("unsub-1", "unsubscribe_topic")], // Missing topicId
      transitions: [transition("trigger", "unsub-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "unsub-1");
    expect(error?.message).toContain("Topic is required");
  });

  it("should pass with topicId", () => {
    const transformed = createTransformed({
      steps: [
        triggerStep(),
        {
          ...topicStep("sub-1", "subscribe_topic"),
          config: { type: "subscribe_topic", topicId: "newsletter" },
        },
      ],
      transitions: [transition("trigger", "sub-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE REFERENCE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Template References", () => {
  it("should validate template references against local templates", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), sendEmailStep("email-1", "nonexistent-template")],
      transitions: [transition("trigger", "email-1")],
    });

    const localTemplates = new Set(["welcome", "tips"]);
    const result = validateTransformedWorkflow(transformed, localTemplates);

    expect(result.isValid).toBe(false);
    const error = getErrorByNodeId(result.errors, "email-1");
    expect(error?.message).toContain("not found in templates/");
  });

  it("should pass when template exists locally", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), sendEmailStep("email-1", "welcome")],
      transitions: [transition("trigger", "email-1")],
    });

    const localTemplates = new Set(["welcome", "tips"]);
    const result = validateTransformedWorkflow(transformed, localTemplates);

    expect(result.isValid).toBe(true);
  });

  it("should skip template validation when no local templates provided", () => {
    const transformed = createTransformed({
      steps: [triggerStep(), sendEmailStep("email-1", "any-template")],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    // Should pass since we're not checking templates
    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR GROUPING
// ═══════════════════════════════════════════════════════════════════════════

describe("validateTransformedWorkflow - Error Grouping", () => {
  it("should group errors by nodeId", () => {
    const transformed = createTransformed({
      steps: [
        {
          ...triggerStep(),
          config: { type: "trigger", triggerType: "event" }, // Missing eventName
        },
        {
          id: "email-1",
          type: "send_email",
          name: "Send email",
          position: { x: 0, y: 200 },
          config: { type: "send_email" }, // Missing template
        },
      ],
      transitions: [transition("trigger", "email-1")],
    });

    const result = validateTransformedWorkflow(transformed);

    expect(result.errorsByNodeId.has("trigger")).toBe(true);
    expect(result.errorsByNodeId.has("email-1")).toBe(true);
    expect(result.errorsByNodeId.get("trigger")?.length).toBeGreaterThan(0);
    expect(result.errorsByNodeId.get("email-1")?.length).toBeGreaterThan(0);
  });
});
