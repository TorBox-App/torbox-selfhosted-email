/**
 * Cascade Shim Tests
 *
 * Tests the cascade() function in the esbuild shim by dynamically
 * importing the shim and calling cascade() directly.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// We'll dynamically import the shim to test cascade()
let cascade: (
  id: string,
  config: {
    channels: Array<{
      type: "email" | "sms";
      template?: string;
      body?: string;
      waitFor?: { hours?: number; minutes?: number; days?: number };
      engagement?: "opened" | "clicked";
    }>;
  }
) => Array<{
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  cascadeGroupId?: string;
  branches?: Record<string, unknown[]>;
}>;

let shimDir: string;

beforeAll(async () => {
  // Create a temp directory and write the shim there
  shimDir = join(tmpdir(), `wraps-shim-test-${Date.now()}`);
  await mkdir(shimDir, { recursive: true });

  // Read the shim content from the actual source (import the module)
  const { parseWorkflowTs } = await import("../workflow-ts.js");

  // We need to extract the shim. Instead, let's write a minimal workflow
  // that uses cascade and parse it to verify the shim works.
  // But for unit testing cascade() directly, let's write the shim manually.

  // Actually, let's write a test workflow file and use parseWorkflowTs
  // to verify that cascade() works through the full esbuild pipeline.
  const workflowSource = `
import { defineWorkflow, cascade, delay, exit } from '@wraps.dev/client';

export default defineWorkflow({
  name: 'Test Cascade',
  trigger: { type: 'event', eventName: 'test.event' },
  steps: [
    delay('initial-wait', { minutes: 5 }),
    ...cascade('recover-cart', {
      channels: [
        {
          type: 'email',
          template: 'cart-recovery',
          waitFor: { hours: 2 },
          engagement: 'opened',
        },
        {
          type: 'sms',
          template: 'cart-sms-reminder',
        },
      ],
    }),
    exit('cascade-complete'),
  ],
});
`;

  const wrapsDir = join(shimDir, "wraps");
  const workflowsDir = join(wrapsDir, "workflows");
  await mkdir(workflowsDir, { recursive: true });
  await writeFile(join(workflowsDir, "test-cascade.ts"), workflowSource);

  // Parse the workflow
  const parsed = await parseWorkflowTs(
    join(workflowsDir, "test-cascade.ts"),
    wrapsDir
  );

  // Store the steps for assertions below
  shimDir = JSON.stringify(parsed.definition.steps);
});

describe("cascade() in esbuild shim", () => {
  it("generates steps with correct cascadeGroupId", () => {
    const steps = JSON.parse(shimDir);

    // Find all cascade steps (those with cascadeGroupId)
    const cascadeSteps = steps.filter(
      (s: { cascadeGroupId?: string }) => s.cascadeGroupId === "recover-cart"
    );

    // Should have: send-0 (email), wait-0, cond-0, send-1 (sms)
    // Plus the exit inside the condition's yes branch
    expect(cascadeSteps.length).toBeGreaterThanOrEqual(3);

    // Every cascade step should have the same cascadeGroupId
    for (const step of cascadeSteps) {
      expect(step.cascadeGroupId).toBe("recover-cart");
    }
  });

  it("uses engagement.status as condition field (not SDK format)", () => {
    const steps = JSON.parse(shimDir);

    // Find condition steps
    const conditionSteps = steps.filter(
      (s: { type: string }) => s.type === "condition"
    );

    for (const step of conditionSteps) {
      if (step.config.field) {
        expect(step.config.field).toBe("engagement.status");
        // Must NOT use the SDK format
        expect(step.config.field).not.toContain("steps.");
        expect(step.config.field).not.toContain(".engaged");
      }
    }
  });

  it("generates email send step with template", () => {
    const steps = JSON.parse(shimDir);

    const emailSend = steps.find(
      (s: { id: string }) => s.id === "recover-cart-send-0"
    );
    expect(emailSend).toBeDefined();
    expect(emailSend.type).toBe("send_email");
    expect(emailSend.config.templateId).toBe("cart-recovery");
    expect(emailSend.cascadeGroupId).toBe("recover-cart");
  });

  it("generates SMS send step", () => {
    const steps = JSON.parse(shimDir);

    const smsSend = steps.find(
      (s: { id: string }) => s.id === "recover-cart-send-1"
    );
    expect(smsSend).toBeDefined();
    expect(smsSend.type).toBe("send_sms");
    expect(smsSend.config.template).toBe("cart-sms-reminder");
    expect(smsSend.cascadeGroupId).toBe("recover-cart");
  });

  it("generates wait_for_email_engagement step with correct timeout", () => {
    const steps = JSON.parse(shimDir);

    const waitStep = steps.find(
      (s: { id: string }) => s.id === "recover-cart-wait-0"
    );
    expect(waitStep).toBeDefined();
    expect(waitStep.type).toBe("wait_for_email_engagement");
    expect(waitStep.config.timeoutSeconds).toBe(7200); // 2 hours
    expect(waitStep.cascadeGroupId).toBe("recover-cart");
  });

  it("includes non-cascade steps (delay, exit) without cascadeGroupId", () => {
    const steps = JSON.parse(shimDir);

    const delayStep = steps.find(
      (s: { id: string }) => s.id === "initial-wait"
    );
    expect(delayStep).toBeDefined();
    expect(delayStep.cascadeGroupId).toBeUndefined();

    const exitStep = steps.find(
      (s: { id: string }) => s.id === "cascade-complete"
    );
    expect(exitStep).toBeDefined();
    expect(exitStep.cascadeGroupId).toBeUndefined();
  });
});

describe("cascade() single channel", () => {
  let singleChannelSteps: string;

  beforeAll(async () => {
    const dir = join(tmpdir(), `wraps-shim-single-${Date.now()}`);
    const wrapsDir = join(dir, "wraps");
    const workflowsDir = join(wrapsDir, "workflows");
    await mkdir(workflowsDir, { recursive: true });

    const source = `
import { defineWorkflow, cascade } from '@wraps.dev/client';

export default defineWorkflow({
  name: 'Single Channel',
  trigger: { type: 'contact_created' },
  steps: [
    ...cascade('notify', {
      channels: [
        { type: 'email', template: 'welcome' },
      ],
    }),
  ],
});
`;
    await writeFile(join(workflowsDir, "single.ts"), source);

    const { parseWorkflowTs } = await import("../workflow-ts.js");
    const parsed = await parseWorkflowTs(
      join(workflowsDir, "single.ts"),
      wrapsDir
    );
    singleChannelSteps = JSON.stringify(parsed.definition.steps);
  });

  it("generates only send step for single-channel cascade (no wait/condition)", () => {
    const steps = JSON.parse(singleChannelSteps);

    // Should only have a single send_email step from cascade
    const cascadeSteps = steps.filter(
      (s: { cascadeGroupId?: string }) => s.cascadeGroupId === "notify"
    );
    expect(cascadeSteps).toHaveLength(1);
    expect(cascadeSteps[0].type).toBe("send_email");
    expect(cascadeSteps[0].id).toBe("notify-send-0");
  });
});
