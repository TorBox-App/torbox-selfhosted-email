/**
 * Workflow Transformer Tests
 *
 * Tests the transformation of user-friendly nested workflow definitions
 * into flat format expected by the database.
 */

import { describe, expect, it } from "vitest";
import {
  type StepDefinition,
  transformWorkflow,
  type WorkflowDefinition,
} from "../workflow-transform.js";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createWorkflow(
  overrides: Partial<WorkflowDefinition> = {}
): WorkflowDefinition {
  return {
    name: "Test Workflow",
    trigger: { type: "contact_created" },
    steps: [],
    ...overrides,
  };
}

function sendEmailStep(id: string, template: string): StepDefinition {
  return {
    id,
    type: "send_email",
    name: `Send ${template}`,
    config: { type: "send_email", template },
  };
}

function delayStep(id: string, amount: number, unit: string): StepDefinition {
  return {
    id,
    type: "delay",
    name: `Wait ${amount} ${unit}`,
    config: { type: "delay", amount, unit },
  };
}

function conditionStep(
  id: string,
  branches: { yes?: StepDefinition[]; no?: StepDefinition[] }
): StepDefinition {
  return {
    id,
    type: "condition",
    name: "Check condition",
    config: {
      type: "condition",
      field: "contact.active",
      operator: "equals",
      value: true,
    },
    branches,
  };
}

function exitStep(id: string): StepDefinition {
  return {
    id,
    type: "exit",
    name: "Exit",
    config: { type: "exit" },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER STEP TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("transformWorkflow - Trigger Step", () => {
  it("should create trigger step with id 'trigger'", () => {
    const workflow = createWorkflow();
    const result = transformWorkflow(workflow);

    const triggerStep = result.steps.find((s) => s.id === "trigger");
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe("trigger");
  });

  it("should set trigger name based on type", () => {
    const workflow = createWorkflow({
      trigger: { type: "event", eventName: "signup" },
    });
    const result = transformWorkflow(workflow);

    const triggerStep = result.steps.find((s) => s.id === "trigger");
    expect(triggerStep?.name).toBe("When event occurs");
  });

  it("should include trigger config in step config", () => {
    const workflow = createWorkflow({
      trigger: { type: "event", eventName: "signup" },
    });
    const result = transformWorkflow(workflow);

    const triggerStep = result.steps.find((s) => s.id === "trigger");
    expect(triggerStep?.config).toEqual({
      type: "trigger",
      triggerType: "event",
      eventName: "signup",
    });
  });

  it("should extract trigger type and config", () => {
    const workflow = createWorkflow({
      trigger: {
        type: "schedule",
        schedule: "0 9 * * *",
        timezone: "America/New_York",
      },
    });
    const result = transformWorkflow(workflow);

    expect(result.triggerType).toBe("schedule");
    expect(result.triggerConfig).toEqual({
      schedule: "0 9 * * *",
      timezone: "America/New_York",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LINEAR STEP TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("transformWorkflow - Linear Steps", () => {
  it("should flatten linear steps", () => {
    const workflow = createWorkflow({
      steps: [
        sendEmailStep("email-1", "welcome"),
        delayStep("delay-1", 1, "days"),
        sendEmailStep("email-2", "tips"),
      ],
    });
    const result = transformWorkflow(workflow);

    // Trigger + 3 steps = 4 total
    expect(result.steps).toHaveLength(4);
    expect(result.steps.map((s) => s.id)).toEqual([
      "trigger",
      "email-1",
      "delay-1",
      "email-2",
    ]);
  });

  it("should create transitions between linear steps", () => {
    const workflow = createWorkflow({
      steps: [
        sendEmailStep("email-1", "welcome"),
        delayStep("delay-1", 1, "days"),
      ],
    });
    const result = transformWorkflow(workflow);

    expect(result.transitions).toHaveLength(2);
    expect(result.transitions[0]).toEqual({
      id: "t-trigger-email-1",
      fromStepId: "trigger",
      toStepId: "email-1",
    });
    expect(result.transitions[1]).toEqual({
      id: "t-email-1-delay-1",
      fromStepId: "email-1",
      toStepId: "delay-1",
    });
  });

  it("should preserve step config", () => {
    const workflow = createWorkflow({
      steps: [sendEmailStep("email-1", "welcome")],
    });
    const result = transformWorkflow(workflow);

    const emailStep = result.steps.find((s) => s.id === "email-1");
    expect(emailStep?.config).toEqual({
      type: "send_email",
      template: "welcome",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BRANCHING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("transformWorkflow - Branches", () => {
  it("should flatten yes branch", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [sendEmailStep("email-yes", "activated")],
          no: [],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    // Trigger + condition + email-yes = 3
    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.id)).toContain("email-yes");
  });

  it("should flatten no branch", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [],
          no: [sendEmailStep("email-no", "reminder")],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.id)).toContain("email-no");
  });

  it("should add branch condition to transitions", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [sendEmailStep("email-yes", "activated")],
          no: [sendEmailStep("email-no", "reminder")],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    const yesTransition = result.transitions.find(
      (t) => t.fromStepId === "check-1" && t.toStepId === "email-yes"
    );
    const noTransition = result.transitions.find(
      (t) => t.fromStepId === "check-1" && t.toStepId === "email-no"
    );

    expect(yesTransition?.condition).toEqual({ branch: "yes" });
    expect(noTransition?.condition).toEqual({ branch: "no" });
  });

  it("should handle nested branches", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [exitStep("exit-yes")],
          no: [
            sendEmailStep("email-1", "tips"),
            conditionStep("check-2", {
              yes: [sendEmailStep("email-2", "promo")],
              no: [exitStep("exit-no")],
            }),
          ],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    // Trigger + check-1 + exit-yes + email-1 + check-2 + email-2 + exit-no = 7
    expect(result.steps).toHaveLength(7);

    // Verify nested branch transitions
    const innerYesTransition = result.transitions.find(
      (t) => t.fromStepId === "check-2" && t.toStepId === "email-2"
    );
    expect(innerYesTransition?.condition).toEqual({ branch: "yes" });
  });

  it("should handle branches with multiple steps", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [
            sendEmailStep("email-1", "first"),
            delayStep("delay-1", 1, "days"),
            sendEmailStep("email-2", "second"),
          ],
          no: [],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    // Verify steps in yes branch are connected sequentially
    const email1ToDelay = result.transitions.find(
      (t) => t.fromStepId === "email-1" && t.toStepId === "delay-1"
    );
    const delayToEmail2 = result.transitions.find(
      (t) => t.fromStepId === "delay-1" && t.toStepId === "email-2"
    );

    expect(email1ToDelay).toBeDefined();
    expect(email1ToDelay?.condition).toBeUndefined(); // Only first step has branch condition
    expect(delayToEmail2).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-LAYOUT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("transformWorkflow - Auto Layout", () => {
  it("should assign positions to all steps", () => {
    const workflow = createWorkflow({
      steps: [
        sendEmailStep("email-1", "welcome"),
        delayStep("delay-1", 1, "days"),
      ],
    });
    const result = transformWorkflow(workflow);

    for (const step of result.steps) {
      expect(step.position).toBeDefined();
      expect(typeof step.position.x).toBe("number");
      expect(typeof step.position.y).toBe("number");
    }
  });

  it("should place trigger at top (y=0)", () => {
    const workflow = createWorkflow({
      steps: [sendEmailStep("email-1", "welcome")],
    });
    const result = transformWorkflow(workflow);

    const triggerStep = result.steps.find((s) => s.id === "trigger");
    expect(triggerStep?.position.y).toBe(0);
  });

  it("should increase y for each level", () => {
    const workflow = createWorkflow({
      steps: [
        sendEmailStep("email-1", "welcome"),
        delayStep("delay-1", 1, "days"),
        sendEmailStep("email-2", "tips"),
      ],
    });
    const result = transformWorkflow(workflow);

    const trigger = result.steps.find((s) => s.id === "trigger");
    const email1 = result.steps.find((s) => s.id === "email-1");
    const delay1 = result.steps.find((s) => s.id === "delay-1");
    const email2 = result.steps.find((s) => s.id === "email-2");

    expect(trigger?.position.y).toBe(0);
    expect(email1?.position.y).toBe(200);
    expect(delay1?.position.y).toBe(400);
    expect(email2?.position.y).toBe(600);
  });

  it("should offset yes branch to the left", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [sendEmailStep("email-yes", "activated")],
          no: [],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    const condition = result.steps.find((s) => s.id === "check-1");
    const emailYes = result.steps.find((s) => s.id === "email-yes");

    expect(emailYes?.position.x).toBeLessThan(condition?.position.x ?? 0);
  });

  it("should offset no branch to the right", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [],
          no: [sendEmailStep("email-no", "reminder")],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    const condition = result.steps.find((s) => s.id === "check-1");
    const emailNo = result.steps.find((s) => s.id === "email-no");

    expect(emailNo?.position.x).toBeGreaterThan(condition?.position.x ?? 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS & DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

describe("transformWorkflow - Settings & Defaults", () => {
  it("should pass through workflow settings", () => {
    const workflow = createWorkflow({
      settings: {
        allowReentry: true,
        reentryDelaySeconds: 3600,
        maxConcurrentExecutions: 100,
      },
    });
    const result = transformWorkflow(workflow);

    expect(result.settings).toEqual({
      allowReentry: true,
      reentryDelaySeconds: 3600,
      maxConcurrentExecutions: 100,
    });
  });

  it("should pass through defaults", () => {
    const workflow = createWorkflow({
      defaults: {
        from: "hello@example.com",
        fromName: "My App",
        replyTo: "support@example.com",
      },
    });
    const result = transformWorkflow(workflow);

    expect(result.defaults).toEqual({
      from: "hello@example.com",
      fromName: "My App",
      replyTo: "support@example.com",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("transformWorkflow - Edge Cases", () => {
  it("should handle workflow with no steps", () => {
    const workflow = createWorkflow({ steps: [] });
    const result = transformWorkflow(workflow);

    // Only trigger step
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].type).toBe("trigger");
    expect(result.transitions).toHaveLength(0);
  });

  it("should handle empty branches", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [],
          no: [],
        }),
      ],
    });
    const result = transformWorkflow(workflow);

    // Trigger + condition = 2
    expect(result.steps).toHaveLength(2);
    // Only trigger -> condition transition
    expect(result.transitions).toHaveLength(1);
  });

  it("should not create duplicate transitions when both branches are empty and followed by a step", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [],
          no: [],
        }),
        sendEmailStep("email-after", "followup"),
      ],
    });
    const result = transformWorkflow(workflow);

    // Trigger + condition + email-after = 3
    expect(result.steps).toHaveLength(3);

    // Only one transition from check-1 to email-after (not two)
    const reconvergenceTransitions = result.transitions.filter(
      (t) => t.fromStepId === "check-1" && t.toStepId === "email-after"
    );
    expect(reconvergenceTransitions).toHaveLength(1);
  });

  it("should generate unique transition IDs", () => {
    const workflow = createWorkflow({
      steps: [
        sendEmailStep("email-1", "welcome"),
        delayStep("delay-1", 1, "days"),
        sendEmailStep("email-2", "tips"),
      ],
    });
    const result = transformWorkflow(workflow);

    const ids = result.transitions.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH RECONVERGENCE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("transformWorkflow - Branch Reconvergence", () => {
  it("should connect branch leaves to the next step after a condition", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [sendEmailStep("email-yes", "activated")],
          no: [sendEmailStep("email-no", "reminder")],
        }),
        // This step should be reachable from BOTH branches
        delayStep("delay-after", 1, "days"),
      ],
    });
    const result = transformWorkflow(workflow);

    // Trigger + condition + email-yes + email-no + delay-after = 5
    expect(result.steps).toHaveLength(5);
    expect(result.steps.map((s) => s.id)).toContain("delay-after");

    // Both branch leaves should transition to delay-after
    const yesToDelay = result.transitions.find(
      (t) => t.fromStepId === "email-yes" && t.toStepId === "delay-after"
    );
    const noToDelay = result.transitions.find(
      (t) => t.fromStepId === "email-no" && t.toStepId === "delay-after"
    );

    expect(yesToDelay).toBeDefined();
    expect(noToDelay).toBeDefined();
    // Reconvergence transitions should NOT have branch conditions
    expect(yesToDelay?.condition).toBeUndefined();
    expect(noToDelay?.condition).toBeUndefined();
  });

  it("should handle reconvergence with empty branches", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [sendEmailStep("email-yes", "activated")],
          no: [], // Empty no branch
        }),
        sendEmailStep("email-after", "followup"),
      ],
    });
    const result = transformWorkflow(workflow);

    // email-yes should connect to email-after
    const yesToAfter = result.transitions.find(
      (t) => t.fromStepId === "email-yes" && t.toStepId === "email-after"
    );
    expect(yesToAfter).toBeDefined();

    // The condition itself should connect to email-after for the empty no branch
    const condToAfter = result.transitions.find(
      (t) => t.fromStepId === "check-1" && t.toStepId === "email-after"
    );
    expect(condToAfter).toBeDefined();
  });

  it("should not reconverge branches that end with exit", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [exitStep("exit-yes")],
          no: [sendEmailStep("email-no", "reminder")],
        }),
        sendEmailStep("email-after", "followup"),
      ],
    });
    const result = transformWorkflow(workflow);

    // exit-yes should NOT connect to email-after
    const exitToAfter = result.transitions.find(
      (t) => t.fromStepId === "exit-yes" && t.toStepId === "email-after"
    );
    expect(exitToAfter).toBeUndefined();

    // email-no SHOULD connect to email-after
    const noToAfter = result.transitions.find(
      (t) => t.fromStepId === "email-no" && t.toStepId === "email-after"
    );
    expect(noToAfter).toBeDefined();
  });

  it("should handle multiple conditions with reconvergence", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("check-1", {
          yes: [],
          no: [sendEmailStep("nudge-1", "reminder-1")],
        }),
        delayStep("delay-1", 3, "days"),
        conditionStep("check-2", {
          yes: [],
          no: [sendEmailStep("nudge-2", "reminder-2")],
        }),
        sendEmailStep("email-final", "final"),
      ],
    });
    const result = transformWorkflow(workflow);

    // All steps should be present
    expect(result.steps.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "trigger",
        "check-1",
        "nudge-1",
        "delay-1",
        "check-2",
        "nudge-2",
        "email-final",
      ])
    );

    // check-1 (empty yes) and nudge-1 should both reach delay-1
    const check1ToDelay = result.transitions.find(
      (t) => t.fromStepId === "check-1" && t.toStepId === "delay-1"
    );
    const nudge1ToDelay = result.transitions.find(
      (t) => t.fromStepId === "nudge-1" && t.toStepId === "delay-1"
    );
    expect(check1ToDelay).toBeDefined();
    expect(nudge1ToDelay).toBeDefined();

    // check-2 (empty yes) and nudge-2 should both reach email-final
    const check2ToFinal = result.transitions.find(
      (t) => t.fromStepId === "check-2" && t.toStepId === "email-final"
    );
    const nudge2ToFinal = result.transitions.find(
      (t) => t.fromStepId === "nudge-2" && t.toStepId === "email-final"
    );
    expect(check2ToFinal).toBeDefined();
    expect(nudge2ToFinal).toBeDefined();
  });

  it("should handle nested conditions with reconvergence at outer level", () => {
    const workflow = createWorkflow({
      steps: [
        conditionStep("outer", {
          yes: [
            conditionStep("inner", {
              yes: [sendEmailStep("email-a", "a")],
              no: [sendEmailStep("email-b", "b")],
            }),
          ],
          no: [sendEmailStep("email-c", "c")],
        }),
        sendEmailStep("email-after", "after"),
      ],
    });
    const result = transformWorkflow(workflow);

    // Inner branch leaves (email-a, email-b) and outer no leaf (email-c)
    // should all reach email-after
    const aToAfter = result.transitions.find(
      (t) => t.fromStepId === "email-a" && t.toStepId === "email-after"
    );
    const bToAfter = result.transitions.find(
      (t) => t.fromStepId === "email-b" && t.toStepId === "email-after"
    );
    const cToAfter = result.transitions.find(
      (t) => t.fromStepId === "email-c" && t.toStepId === "email-after"
    );

    expect(aToAfter).toBeDefined();
    expect(bToAfter).toBeDefined();
    expect(cToAfter).toBeDefined();
  });
});
