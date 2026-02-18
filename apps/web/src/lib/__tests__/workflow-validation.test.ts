import type { WorkflowStep, WorkflowTransition } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { validateWorkflow } from "../workflow-validation";

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createTriggerStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: "trigger-1",
    type: "trigger",
    name: "Trigger",
    position: { x: 0, y: 0 },
    config: { type: "trigger", triggerType: "contact_created" },
    ...overrides,
  };
}

function createSendEmailStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: "email-1",
    type: "send_email",
    name: "Send Email",
    position: { x: 0, y: 100 },
    config: { type: "send_email", templateId: "template-123" },
    ...overrides,
  };
}

function createConditionStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: "condition-1",
    type: "condition",
    name: "Condition",
    position: { x: 0, y: 100 },
    config: {
      type: "condition",
      field: "email",
      operator: "contains",
      value: "@gmail.com",
    },
    ...overrides,
  };
}

function createDelayStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: "delay-1",
    type: "delay",
    name: "Delay",
    position: { x: 0, y: 100 },
    config: { type: "delay", amount: 1, unit: "days" },
    ...overrides,
  };
}

function createWebhookStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: "webhook-1",
    type: "webhook",
    name: "Webhook",
    position: { x: 0, y: 100 },
    config: {
      type: "webhook",
      url: "https://example.com/hook",
      method: "POST",
    },
    ...overrides,
  };
}

function createTopicStep(
  action: "subscribe_topic" | "unsubscribe_topic",
  overrides?: Partial<WorkflowStep>
): WorkflowStep {
  return {
    id: `${action}-1`,
    type: action,
    name: action === "subscribe_topic" ? "Subscribe" : "Unsubscribe",
    position: { x: 0, y: 100 },
    config: { type: action, topicId: "topic-123", channel: "email" },
    ...overrides,
  };
}

function createWaitForEventStep(
  overrides?: Partial<WorkflowStep>
): WorkflowStep {
  return {
    id: "wait-1",
    type: "wait_for_event",
    name: "Wait for Event",
    position: { x: 0, y: 100 },
    config: {
      type: "wait_for_event",
      eventName: "purchase.completed",
      timeoutSeconds: 86_400,
    },
    ...overrides,
  };
}

function createExitStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: "exit-1",
    type: "exit",
    name: "Exit",
    position: { x: 0, y: 200 },
    config: { type: "exit" },
    ...overrides,
  };
}

function createTransition(
  fromStepId: string,
  toStepId: string,
  branch?: "yes" | "no" | "timeout" | "default"
): WorkflowTransition {
  return {
    id: `${fromStepId}-${toStepId}`,
    fromStepId,
    toStepId,
    condition: branch ? { branch } : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Workflow Validation - Structure", () => {
  describe("trigger node validation", () => {
    it("should require exactly one trigger node", () => {
      const steps: WorkflowStep[] = [createSendEmailStep()];
      const transitions: WorkflowTransition[] = [];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: "Workflow must have a trigger node",
        })
      );
    });

    it("should reject multiple trigger nodes", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({ id: "trigger-1" }),
        createTriggerStep({ id: "trigger-2" }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: "Workflow can only have one trigger node",
        })
      );
    });

    it("should pass with exactly one trigger node", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("action step validation", () => {
    it("should require at least one action step", () => {
      const steps: WorkflowStep[] = [createTriggerStep(), createExitStep()];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "exit-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: "Workflow must have at least one action step",
        })
      );
    });

    it("should pass with trigger and one action step", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("orphan node detection", () => {
    it("should warn about nodes not connected to trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createSendEmailStep({ id: "email-1" }),
        createSendEmailStep({ id: "email-orphan", name: "Orphan Email" }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
        // email-orphan has no incoming connection
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "email-orphan",
          message: '"Orphan Email" is not connected to the workflow',
          severity: "warning",
        })
      );
    });

    it("should not warn about nodes reachable through multiple hops", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createDelayStep({ id: "delay-1" }),
        createSendEmailStep({ id: "email-1" }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "delay-1"),
        createTransition("delay-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
      expect(
        result.errors.filter((e) => e.severity === "warning")
      ).toHaveLength(0);
    });
  });

  describe("transition validation", () => {
    it("should error on transitions to non-existent steps", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "non-existent"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: "Transition references non-existent target step",
        })
      );
    });

    it("should error on transitions from non-existent steps", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("non-existent", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: "Transition references non-existent source step",
        })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Workflow Validation - Trigger Config", () => {
  describe("event trigger", () => {
    it("should require eventName for event trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: { type: "trigger", triggerType: "event", eventName: "" },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "trigger-1",
          field: "eventName",
          message: "Trigger: event name is required",
        })
      );
    });

    it("should pass with valid eventName", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "event",
            eventName: "user.signup",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("segment trigger", () => {
    it("should require segmentId for segment_entry trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "segment_entry",
            segmentId: "",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "trigger-1",
          field: "segmentId",
          message: "Segment is required",
        })
      );
    });

    it("should require segmentId for segment_exit trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "segment_exit",
            segmentId: "",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "segmentId" })
      );
    });
  });

  describe("topic trigger", () => {
    it("should require topicId for topic_subscribed trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "topic_subscribed",
            topicId: "",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "trigger-1",
          field: "topicId",
          message: "Topic is required",
        })
      );
    });

    it("should require topicId for topic_unsubscribed trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "topic_unsubscribed",
            topicId: "",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "topicId" })
      );
    });
  });

  describe("schedule trigger", () => {
    it("should require schedule for schedule trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "schedule",
            schedule: "",
            timezone: "UTC",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "trigger-1",
          field: "schedule",
          message: "Schedule (cron expression) is required",
        })
      );
    });

    it("should require timezone for schedule trigger", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "schedule",
            schedule: "0 9 * * *",
            timezone: "",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "trigger-1",
          field: "timezone",
          message: "Timezone is required",
        })
      );
    });

    it("should pass with valid schedule and timezone", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: {
            type: "trigger",
            triggerType: "schedule",
            schedule: "0 9 * * 1",
            timezone: "America/New_York",
          },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("simple triggers", () => {
    it("should pass contact_created without extra config", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: { type: "trigger", triggerType: "contact_created" },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });

    it("should pass contact_updated without extra config", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: { type: "trigger", triggerType: "contact_updated" },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });

    it("should pass api trigger without extra config", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep({
          config: { type: "trigger", triggerType: "api" },
        }),
        createSendEmailStep(),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STEP VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Workflow Validation - Step Config", () => {
  describe("send_email step", () => {
    it("should require templateId", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createSendEmailStep({
          config: { type: "send_email", templateId: "" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "email-1",
          field: "templateId",
          message: "Email template is required",
        })
      );
    });

    it("should pass with valid templateId", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createSendEmailStep({
          config: { type: "send_email", templateId: "template-123" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "email-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("condition step", () => {
    it("should require field", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createConditionStep({
          config: {
            type: "condition",
            field: "",
            operator: "equals",
            value: "test",
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "condition-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "condition-1",
          field: "field",
          message: "Condition field is required",
        })
      );
    });

    it("should require operator", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createConditionStep({
          config: {
            type: "condition",
            field: "email",
            operator: "",
            value: "test",
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "condition-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "condition-1",
          field: "operator",
          message: "Condition operator is required",
        })
      );
    });

    it("should require value for most operators", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createConditionStep({
          config: {
            type: "condition",
            field: "email",
            operator: "equals",
            value: "",
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "condition-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "condition-1",
          field: "value",
          message: "Condition value is required",
        })
      );
    });

    it("should not require value for is_set operator", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createConditionStep({
          config: {
            type: "condition",
            field: "phone",
            operator: "is_set",
            value: "",
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "condition-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });

    it("should not require value for is_not_set operator", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createConditionStep({
          config: {
            type: "condition",
            field: "phone",
            operator: "is_not_set",
            value: "",
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "condition-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("webhook step", () => {
    it("should require url", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createWebhookStep({
          config: { type: "webhook", url: "", method: "POST" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "webhook-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "webhook-1",
          field: "url",
          message: "Webhook URL is required",
        })
      );
    });

    it("should validate url format", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createWebhookStep({
          config: { type: "webhook", url: "not-a-valid-url", method: "POST" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "webhook-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "webhook-1",
          field: "url",
          message: "Invalid URL format",
        })
      );
    });

    it("should pass with valid url", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createWebhookStep({
          config: {
            type: "webhook",
            url: "https://example.com/webhook",
            method: "POST",
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "webhook-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("topic steps", () => {
    it("should require topicId for subscribe_topic", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createTopicStep("subscribe_topic", {
          config: { type: "subscribe_topic", topicId: "", channel: "email" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "subscribe_topic-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "subscribe_topic-1",
          field: "topicId",
          message: "Topic is required",
        })
      );
    });

    it("should require topicId for unsubscribe_topic", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createTopicStep("unsubscribe_topic", {
          config: { type: "unsubscribe_topic", topicId: "", channel: "email" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "unsubscribe_topic-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "topicId" })
      );
    });
  });

  describe("wait_for_event step", () => {
    it("should require eventName", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createWaitForEventStep({
          config: {
            type: "wait_for_event",
            eventName: "",
            timeoutSeconds: 86_400,
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "wait-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "wait-1",
          field: "eventName",
          message: "Wait for Event: event name is required",
        })
      );
    });

    it("should pass with valid eventName", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createWaitForEventStep({
          config: {
            type: "wait_for_event",
            eventName: "order.completed",
            timeoutSeconds: 86_400,
          },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "wait-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });

  describe("delay step", () => {
    it("should require positive amount", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createDelayStep({
          config: { type: "delay", amount: 0, unit: "days" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "delay-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          nodeId: "delay-1",
          field: "amount",
          message: "Delay duration must be at least 1",
        })
      );
    });

    it("should pass with valid amount", () => {
      const steps: WorkflowStep[] = [
        createTriggerStep(),
        createDelayStep({
          config: { type: "delay", amount: 3, unit: "hours" },
        }),
      ];
      const transitions: WorkflowTransition[] = [
        createTransition("trigger-1", "delay-1"),
      ];

      const result = validateWorkflow(steps, transitions);

      expect(result.isValid).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR GROUPING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Workflow Validation - Error Grouping", () => {
  it("should group errors by nodeId", () => {
    const steps: WorkflowStep[] = [
      createTriggerStep({
        config: { type: "trigger", triggerType: "event", eventName: "" },
      }),
      createSendEmailStep({
        config: { type: "send_email", templateId: "" },
      }),
    ];
    const transitions: WorkflowTransition[] = [
      createTransition("trigger-1", "email-1"),
    ];

    const result = validateWorkflow(steps, transitions);

    expect(result.errorsByNodeId.get("trigger-1")).toHaveLength(1);
    expect(result.errorsByNodeId.get("email-1")).toHaveLength(1);
  });

  it("should include all errors for a node with multiple issues", () => {
    const steps: WorkflowStep[] = [
      createTriggerStep(),
      createConditionStep({
        config: { type: "condition", field: "", operator: "", value: "" },
      }),
    ];
    const transitions: WorkflowTransition[] = [
      createTransition("trigger-1", "condition-1"),
    ];

    const result = validateWorkflow(steps, transitions);

    const conditionErrors = result.errorsByNodeId.get("condition-1") || [];
    expect(conditionErrors.length).toBeGreaterThanOrEqual(2);
    expect(conditionErrors.map((e) => e.field)).toContain("field");
    expect(conditionErrors.map((e) => e.field)).toContain("operator");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPLEX WORKFLOW TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Workflow Validation - Complex Workflows", () => {
  it("should validate a complete welcome email workflow", () => {
    const steps: WorkflowStep[] = [
      createTriggerStep({
        config: { type: "trigger", triggerType: "contact_created" },
      }),
      createDelayStep({
        id: "delay-1",
        config: { type: "delay", amount: 1, unit: "hours" },
      }),
      createSendEmailStep({
        id: "email-1",
        config: { type: "send_email", templateId: "welcome-template" },
      }),
      createExitStep({ id: "exit-1" }),
    ];
    const transitions: WorkflowTransition[] = [
      createTransition("trigger-1", "delay-1"),
      createTransition("delay-1", "email-1"),
      createTransition("email-1", "exit-1"),
    ];

    const result = validateWorkflow(steps, transitions);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate a conditional branching workflow", () => {
    const steps: WorkflowStep[] = [
      createTriggerStep({
        config: {
          type: "trigger",
          triggerType: "event",
          eventName: "purchase.completed",
        },
      }),
      createConditionStep({
        id: "condition-1",
        config: {
          type: "condition",
          field: "properties.total",
          operator: "greater_than",
          value: "100",
        },
      }),
      createSendEmailStep({
        id: "email-vip",
        name: "VIP Email",
        config: { type: "send_email", templateId: "vip-template" },
      }),
      createSendEmailStep({
        id: "email-regular",
        name: "Regular Email",
        config: { type: "send_email", templateId: "regular-template" },
      }),
    ];
    const transitions: WorkflowTransition[] = [
      createTransition("trigger-1", "condition-1"),
      createTransition("condition-1", "email-vip", "yes"),
      createTransition("condition-1", "email-regular", "no"),
    ];

    const result = validateWorkflow(steps, transitions);

    expect(result.isValid).toBe(true);
  });
});
