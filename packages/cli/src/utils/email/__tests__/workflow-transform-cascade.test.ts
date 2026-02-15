/**
 * Workflow Transform Cascade Tests
 *
 * Verifies that cascadeGroupId is preserved through the transform pipeline
 * and that cascade steps get correct transitions.
 */

import { describe, expect, it } from "vitest";
import {
  transformWorkflow,
  type WorkflowDefinition,
} from "../workflow-transform.js";

describe("transformWorkflow — cascadeGroupId preservation", () => {
  it("preserves cascadeGroupId on flat steps after transform", () => {
    const definition: WorkflowDefinition = {
      name: "Cascade Test",
      trigger: { type: "event", eventName: "test" },
      steps: [
        {
          id: "grp-send-0",
          type: "send_email",
          name: "Send Email 1",
          config: { type: "send_email", template: "t1" },
          cascadeGroupId: "grp",
        },
        {
          id: "grp-wait-0",
          type: "wait_for_email_engagement",
          name: "Wait for Engagement",
          config: { type: "wait_for_email_engagement", timeoutSeconds: 7200 },
          cascadeGroupId: "grp",
        },
        {
          id: "grp-cond-0",
          type: "condition",
          name: "Engaged?",
          config: {
            type: "condition",
            field: "engagement.status",
            operator: "equals",
            value: "true",
          },
          cascadeGroupId: "grp",
          branches: {
            yes: [
              {
                id: "grp-exit-0",
                type: "exit",
                name: "Exit",
                config: { type: "exit", reason: "Engaged" },
                cascadeGroupId: "grp",
              },
            ],
          },
        },
        {
          id: "grp-send-1",
          type: "send_sms",
          name: "Send SMS",
          config: { type: "send_sms", template: "sms-t" },
          cascadeGroupId: "grp",
        },
      ],
    };

    const transformed = transformWorkflow(definition);

    // All cascade steps should have cascadeGroupId preserved
    const cascadeSteps = transformed.steps.filter(
      (s) => (s as { cascadeGroupId?: string }).cascadeGroupId === "grp"
    );
    expect(cascadeSteps.length).toBe(5); // send-0, wait-0, cond-0, exit-0, send-1

    // Non-cascade steps (trigger) should not have cascadeGroupId
    const trigger = transformed.steps.find((s) => s.type === "trigger");
    expect(
      (trigger as { cascadeGroupId?: string }).cascadeGroupId
    ).toBeUndefined();
  });

  it("SMS continuation uses branchless transition from condition", () => {
    const definition: WorkflowDefinition = {
      name: "SMS Continuation Test",
      trigger: { type: "event", eventName: "test" },
      steps: [
        {
          id: "c-send-0",
          type: "send_email",
          name: "Email",
          config: { type: "send_email", template: "t1" },
          cascadeGroupId: "c",
        },
        {
          id: "c-wait-0",
          type: "wait_for_email_engagement",
          name: "Wait",
          config: { type: "wait_for_email_engagement", timeoutSeconds: 7200 },
          cascadeGroupId: "c",
        },
        {
          id: "c-cond-0",
          type: "condition",
          name: "Engaged?",
          config: {
            type: "condition",
            field: "engagement.status",
            operator: "equals",
            value: "true",
          },
          cascadeGroupId: "c",
          branches: {
            yes: [
              {
                id: "c-exit-0",
                type: "exit",
                name: "Exit",
                config: { type: "exit" },
                cascadeGroupId: "c",
              },
            ],
          },
        },
        {
          id: "c-send-1",
          type: "send_sms",
          name: "SMS",
          config: { type: "send_sms", body: "Hi" },
          cascadeGroupId: "c",
        },
      ],
    };

    const transformed = transformWorkflow(definition);

    // The transition from condition to SMS should be branchless (no condition)
    // This is because the SMS step is in the "no" (fallthrough) path
    const condToSms = transformed.transitions.find(
      (t) => t.fromStepId === "c-cond-0" && t.toStepId === "c-send-1"
    );
    expect(condToSms).toBeDefined();
    // Should not have a branch condition - it's a fallthrough
    expect(condToSms?.condition).toBeUndefined();

    // The "yes" branch should go to exit
    const condToExit = transformed.transitions.find(
      (t) => t.fromStepId === "c-cond-0" && t.toStepId === "c-exit-0"
    );
    expect(condToExit).toBeDefined();
    expect(condToExit?.condition).toEqual({ branch: "yes" });
  });

  it("steps without cascadeGroupId are not affected", () => {
    const definition: WorkflowDefinition = {
      name: "Mixed Steps",
      trigger: { type: "contact_created" },
      steps: [
        {
          id: "regular-email",
          type: "send_email",
          name: "Regular Email",
          config: { type: "send_email", template: "t1" },
          // No cascadeGroupId
        },
      ],
    };

    const transformed = transformWorkflow(definition);
    const emailStep = transformed.steps.find((s) => s.id === "regular-email");
    expect(emailStep).toBeDefined();
    expect(
      (emailStep as { cascadeGroupId?: string }).cascadeGroupId
    ).toBeUndefined();
  });
});
