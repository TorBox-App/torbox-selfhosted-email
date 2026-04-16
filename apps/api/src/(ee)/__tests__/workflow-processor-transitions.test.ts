/**
 * Workflow Processor Transition Routing Tests
 *
 * Tests `processNextStep` routing logic via the SQS handler:
 * - Branch-specific transitions (condition step -> "yes"/"no" branch)
 * - Branchless fallback when branch has no matching transition
 * - Terminal completion when no transitions leave the current step
 */

import type { SQSEvent } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    contactId: "contact-1",
    organizationId: "org-1",
    status: "active",
    currentStepId: "step-cond",
    triggerData: {},
    startedAt: new Date(),
    completedAt: null,
    error: null,
    errorStepId: null,
    allowReentry: false,
    waitingForEvent: null,
    waitTimeoutAt: null,
    waitTimeoutSchedulerName: null,
    delaySchedulerName: null,
    nextStepScheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: "contact-1",
    email: "test@example.com",
    phone: null,
    firstName: "Test",
    lastName: "User",
    company: null,
    jobTitle: null,
    organizationId: "org-1",
    emailStatus: "active",
    status: "active",
    properties: {},
    preferredChannel: null,
    ...overrides,
  };
}

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wf-1",
    organizationId: "org-1",
    name: "Transition Test Workflow",
    status: "enabled",
    triggerType: "event",
    triggerConfig: {},
    awsAccountId: "aws-1",
    allowReentry: false,
    reentryDelaySeconds: null,
    contactCooldownSeconds: null,
    maxConcurrentExecutions: null,
    steps: [],
    transitions: [],
    defaultFrom: "noreply@test.com",
    defaultFromName: "Test",
    defaultReplyTo: null,
    defaultSenderId: null,
    totalExecutions: 0,
    activeExecutions: 0,
    completedExecutions: 0,
    failedExecutions: 0,
    droppedExecutions: 0,
    lastTriggeredAt: null,
    ...overrides,
  };
}

function makeSQSEvent(...bodies: Record<string, unknown>[]): SQSEvent {
  return {
    Records: bodies.map((body, i) => ({
      messageId: `msg-${i}`,
      receiptHandle: `rh-${i}`,
      body: JSON.stringify(body),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "0",
        SenderId: "test",
        ApproximateFirstReceiveTimestamp: "0",
      },
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:000:test",
      awsRegion: "us-east-1",
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockEnqueueWorkflowStep = vi.fn();
const mockEnqueueWorkflowStepBatch = vi.fn();
const mockScheduleWaitTimeout = vi.fn().mockResolvedValue("sched-wait-123");
const mockScheduleWorkflowStep = vi.fn().mockResolvedValue("sched-step-123");
const mockDeleteScheduledStep = vi.fn();
const mockCreateNextWorkflowSchedule = vi.fn();
const mockFetch = vi.fn();

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbTransaction = vi.fn();
const mockDbQueryWorkflowExecution = { findFirst: vi.fn() };

mockDbTransaction.mockImplementation(async (callback: Function) =>
  callback({
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
  })
);

vi.mock("@aws-sdk/client-sesv2", () => {
  class MockSESv2Client {
    send() {
      return Promise.resolve({ MessageId: "ses-msg-1" });
    }
  }
  function SendEmailCommand(this: unknown, input: unknown) {
    return input;
  }
  return { SESv2Client: MockSESv2Client, SendEmailCommand };
});

vi.mock("@aws-sdk/client-pinpoint-sms-voice-v2", () => {
  class MockPinpointSMSVoiceV2Client {
    send() {
      return Promise.resolve({ MessageId: "sms-msg-1" });
    }
  }
  function SendTextMessageCommand(this: unknown, input: unknown) {
    return input;
  }
  return {
    PinpointSMSVoiceV2Client: MockPinpointSMSVoiceV2Client,
    SendTextMessageCommand,
  };
});

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("plain text fallback"),
}));

vi.mock("@wraps/email", () => ({
  generateSESTemplateName: vi.fn().mockReturnValue("ses-tmpl-name"),
  transformVariablesForSes: vi.fn((s: string) => s),
  upsertSESTemplate: vi.fn(),
}));

vi.mock("handlebars", () => ({
  default: {
    compile: vi
      .fn()
      .mockReturnValue(
        (data: Record<string, string>) => `compiled:${JSON.stringify(data)}`
      ),
  },
}));

vi.mock("../../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockReturnValue("mock-token"),
}));

vi.mock("../../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIA",
    secretAccessKey: "secret",
    sessionToken: "tok",
  }),
}));

vi.mock("../../services/workflow-queue", () => ({
  enqueueWorkflowStep: mockEnqueueWorkflowStep,
  enqueueWorkflowStepBatch: mockEnqueueWorkflowStepBatch,
  scheduleWaitTimeout: mockScheduleWaitTimeout,
  scheduleWorkflowStep: mockScheduleWorkflowStep,
  deleteScheduledStep: mockDeleteScheduledStep,
}));

vi.mock("../../services/workflow-scheduler", () => ({
  createNextWorkflowSchedule: mockCreateNextWorkflowSchedule,
}));

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
  return {
    ...actual,
    db: {
      select: mockDbSelect,
      update: mockDbUpdate,
      insert: mockDbInsert,
      transaction: mockDbTransaction,
      query: { workflowExecution: mockDbQueryWorkflowExecution },
    },
    contactIdsMatchingCondition: vi.fn().mockResolvedValue([]),
    sql: (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      sql: strings.join("?"),
    }),
  };
});

const mockDnsLookup = vi
  .fn()
  .mockResolvedValue({ address: "93.184.216.34", family: 4 });
vi.mock("node:dns/promises", () => ({
  default: { lookup: mockDnsLookup },
  lookup: mockDnsLookup,
}));

vi.stubGlobal("fetch", mockFetch);

const { handler } = await import("../workers/workflow-processor");

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupProcessStep(opts: {
  execution?: Record<string, unknown>;
  workflow?: Record<string, unknown>;
  contact?: Record<string, unknown>;
}) {
  const exec = makeExecution(opts.execution);
  const wf = makeWorkflow(opts.workflow);
  const ct = makeContact(opts.contact);

  mockDbQueryWorkflowExecution.findFirst.mockResolvedValue(exec);

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([wf]),
          }),
        }),
      };
    }
    if (selectCallCount === 2) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([ct]),
          }),
        }),
      };
    }
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
  });

  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "se-1",
            status: "executing",
            idempotencyKey: `${exec.id}-${exec.currentStepId}`,
          },
        ]),
      }),
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  });

  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([exec]),
      }),
    }),
  });

  return { exec, wf, ct };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  mockDnsLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
  mockDbTransaction.mockImplementation(async (callback: Function) =>
    callback({
      select: mockDbSelect,
      update: mockDbUpdate,
      insert: mockDbInsert,
    })
  );
});

describe("processNextStep transition routing", () => {
  const executeCondJob = {
    type: "execute" as const,
    executionId: "exec-1",
    stepId: "step-cond",
    organizationId: "org-1",
  };

  it("routes branch-specific transition (yes -> matching toStepId)", async () => {
    setupProcessStep({
      execution: { currentStepId: "step-cond" },
      contact: { properties: { tier: "gold" } },
      workflow: {
        steps: [
          { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
          {
            id: "step-cond",
            type: "condition",
            config: {
              type: "condition",
              field: "tier",
              operator: "equals",
              value: "gold",
            },
          },
          {
            id: "step-yes",
            type: "webhook",
            config: { type: "webhook", url: "https://x.com", method: "POST" },
          },
          {
            id: "step-no",
            type: "webhook",
            config: { type: "webhook", url: "https://y.com", method: "POST" },
          },
        ],
        transitions: [
          {
            id: "t1",
            fromStepId: "trigger-1",
            toStepId: "step-cond",
            condition: null,
          },
          {
            id: "t2",
            fromStepId: "step-cond",
            toStepId: "step-yes",
            condition: { branch: "yes" },
          },
          {
            id: "t3",
            fromStepId: "step-cond",
            toStepId: "step-no",
            condition: { branch: "no" },
          },
        ],
      },
    });

    await handler(makeSQSEvent(executeCondJob));

    expect(mockEnqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-yes",
      })
    );
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalledWith(
      expect.objectContaining({ stepId: "step-no" })
    );
  });

  // NOTE: This test verifies the branchless fallback fires when no branch-specific
  // transition exists for the resolved branch. It does NOT distinguish "condition
  // evaluated to yes + no yes transition" from "condition evaluation failed +
  // fallback by default" — both produce the same result. See the preceding
  // branch-specific test for proof that the condition evaluator produces the
  // correct branch.
  it("falls back to branchless transition when branch has no matching transition", async () => {
    setupProcessStep({
      execution: { currentStepId: "step-cond" },
      contact: { properties: { tier: "gold" } },
      workflow: {
        steps: [
          { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
          {
            id: "step-cond",
            type: "condition",
            config: {
              type: "condition",
              field: "tier",
              operator: "equals",
              value: "gold",
            },
          },
          {
            id: "step-fallback",
            type: "webhook",
            config: {
              type: "webhook",
              url: "https://fallback.example.com",
              method: "POST",
            },
          },
        ],
        // Only a branchless transition exists from step-cond.
        // Resolved branch will be "yes" (tier equals gold) but no "yes" transition exists.
        transitions: [
          {
            id: "t1",
            fromStepId: "trigger-1",
            toStepId: "step-cond",
            condition: null,
          },
          {
            id: "t2",
            fromStepId: "step-cond",
            toStepId: "step-fallback",
            condition: null,
          },
        ],
      },
    });

    await handler(makeSQSEvent(executeCondJob));

    expect(mockEnqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-fallback",
      })
    );
  });

  it("completes execution when no transitions leave the current step", async () => {
    setupProcessStep({
      execution: { currentStepId: "step-cond" },
      contact: { properties: { tier: "gold" } },
      workflow: {
        steps: [
          { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
          {
            id: "step-cond",
            type: "condition",
            config: {
              type: "condition",
              field: "tier",
              operator: "equals",
              value: "gold",
            },
          },
        ],
        // No transitions leaving step-cond — terminal.
        transitions: [
          {
            id: "t1",
            fromStepId: "trigger-1",
            toStepId: "step-cond",
            condition: null,
          },
        ],
      },
    });

    await handler(makeSQSEvent(executeCondJob));

    // No next step enqueued
    const executeEnqueues = mockEnqueueWorkflowStep.mock.calls.filter(
      (call) => (call[0] as { type?: string }).type === "execute"
    );
    expect(executeEnqueues).toHaveLength(0);

    // All db.update() calls share the same .set mock object because setupProcessStep
    // uses mockDbUpdate.mockReturnValue({...}). Enumerate every set-call payload
    // across every update to find the workflow-completion update.
    const allSetCalls = (mockDbUpdate.mock.results[0]?.value.set.mock.calls ??
      []) as unknown[][];
    const completedUpdate = allSetCalls.find(
      ([arg]) => (arg as Record<string, unknown>)?.status === "completed"
    );
    expect(completedUpdate).toBeDefined();
  });
});
