/**
 * Workflow Stat Counter Tests
 *
 * Verifies that:
 * 1. completeExecution wraps execution status + workflow stats in a transaction
 * 2. failExecution wraps execution status + workflow stats in a transaction
 * 3. triggerWorkflow wraps execution insert + workflow stats in a transaction
 * 4-7. reconcileWorkflowStats computes and corrects drifted counters
 */

import type { SQSEvent } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mock data factories
// ─────────────────────────────────────────────────────────────────────────────

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wf-1",
    organizationId: "org-1",
    name: "Test Workflow",
    status: "enabled",
    triggerType: "event",
    triggerConfig: {},
    awsAccountId: "aws-1",
    allowReentry: false,
    reentryDelaySeconds: null,
    contactCooldownSeconds: null,
    maxConcurrentExecutions: null,
    steps: [
      { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
      {
        id: "step-1",
        type: "wait_for_event",
        config: { type: "wait_for_event", eventName: "x" },
      },
    ],
    transitions: [
      {
        id: "t1",
        fromStepId: "trigger-1",
        toStepId: "step-1",
        condition: null,
      },
    ],
    defaultFrom: null,
    defaultFromName: null,
    defaultReplyTo: null,
    defaultSenderId: null,
    totalExecutions: 5,
    activeExecutions: 2,
    completedExecutions: 2,
    failedExecutions: 1,
    droppedExecutions: 0,
    lastTriggeredAt: null,
    ...overrides,
  };
}

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    contactId: "contact-1",
    organizationId: "org-1",
    status: "active",
    currentStepId: "step-1",
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
// Module-level mocks (before handler import)
// ─────────────────────────────────────────────────────────────────────────────

const mockEnqueueWorkflowStep = vi.fn();
const mockEnqueueWorkflowStepBatch = vi.fn();
const mockScheduleWaitTimeout = vi.fn().mockResolvedValue("sched-wait-123");
const mockScheduleWorkflowStep = vi.fn().mockResolvedValue("sched-step-123");
const mockDeleteScheduledStep = vi.fn();
const mockCreateNextWorkflowSchedule = vi.fn();

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbTransaction = vi.fn();
const mockDbQueryWorkflowExecution = { findFirst: vi.fn() };

// Transaction mock: delegates to the same underlying mocks so existing
// db.update/insert chains work inside the transaction callback too.
mockDbTransaction.mockImplementation(
  (callback: (tx: Record<string, unknown>) => unknown) =>
    callback({
      select: mockDbSelect,
      update: mockDbUpdate,
      insert: mockDbInsert,
    })
);

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  SendEmailCommand: vi.fn(),
}));

vi.mock("@aws-sdk/client-pinpoint-sms-voice-v2", () => ({
  PinpointSMSVoiceV2Client: vi
    .fn()
    .mockImplementation(() => ({ send: vi.fn() })),
  SendTextMessageCommand: vi.fn(),
}));

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("plain text"),
}));

vi.mock("@wraps/email", () => ({
  generateSESTemplateName: vi.fn().mockReturnValue("ses-tmpl-name"),
  transformVariablesForSes: vi.fn((s: string) => s),
  upsertSESTemplate: vi.fn(),
}));

vi.mock("handlebars", () => ({
  default: { compile: vi.fn().mockReturnValue(() => "compiled") },
}));

vi.mock("../../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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
      query: {
        workflowExecution: mockDbQueryWorkflowExecution,
      },
    },
    contactIdsMatchingCondition: vi.fn().mockResolvedValue(["c-1", "c-3"]),
    sql: (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      sql: strings.join("?"),
    }),
  };
});

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }) },
  lookup: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }),
}));

// Import handler AFTER all mocks are set up
const { handler } = await import("../workers/workflow-processor");

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Re-initialize the transaction mock after clearAllMocks
  mockDbTransaction.mockImplementation(
    (callback: (tx: Record<string, unknown>) => unknown) =>
      callback({
        select: mockDbSelect,
        update: mockDbUpdate,
        insert: mockDbInsert,
      })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Unit 1: completeExecution uses a transaction
// ═══════════════════════════════════════════════════════════════════════════

describe("completeExecution atomicity", () => {
  it("uses a transaction to update execution status and workflow stats together", async () => {
    // Set up a workflow with one step and no outgoing transitions → completeExecution
    const wf = makeWorkflow({
      steps: [
        {
          id: "step-wait",
          type: "wait_for_event",
          config: { type: "wait_for_event", eventName: "x" },
        },
      ],
      transitions: [], // no transitions → triggers completeExecution
    });

    const claimedExecution = makeExecution({
      currentStepId: "step-wait",
      waitTimeoutSchedulerName: null,
    });

    // db.update for: atomic claim, step execution completion,
    // then inside transaction: execution status + workflow stats
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([claimedExecution]),
        }),
      }),
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wf]),
        }),
      }),
    });

    await handler(
      makeSQSEvent({
        type: "resume",
        executionId: "exec-1",
        branch: "timeout",
      }),
      {} as never,
      vi.fn()
    );

    // completeExecution should use db.transaction
    expect(mockDbTransaction).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Unit 2: failExecution uses a transaction
// ═══════════════════════════════════════════════════════════════════════════

describe("failExecution atomicity", () => {
  it("uses a transaction to update execution status and workflow stats together", async () => {
    const wf = makeWorkflow();
    const exec = makeExecution();

    // processStep loads execution via db.query.workflowExecution.findFirst
    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue(exec);

    // processStep loads workflow and then contact via db.select chains
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount += 1;
      if (selectCallCount === 1) {
        // Load workflow
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([wf]),
            }),
          }),
        };
      }
      // Load contact → empty → triggers failExecution("Contact not found")
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    // failExecution's transaction internally calls update
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([exec]),
        }),
      }),
    });

    await handler(
      makeSQSEvent({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-1",
        organizationId: "org-1",
      }),
      {} as never,
      vi.fn()
    );

    // failExecution should use db.transaction
    expect(mockDbTransaction).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Unit 3: triggerWorkflow uses a transaction
// ═══════════════════════════════════════════════════════════════════════════

describe("triggerWorkflow atomicity", () => {
  it("uses a transaction to insert execution and update stats together", async () => {
    const wf = makeWorkflow();

    // Load workflow
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wf]),
        }),
      }),
    });

    // Insert execution → returns new row
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([
              { id: "exec-new", workflowId: "wf-1", contactId: "contact-1" },
            ]),
        }),
      }),
    });

    // Update for stats
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(
      makeSQSEvent({
        type: "trigger",
        workflowId: "wf-1",
        contactId: "contact-1",
        organizationId: "org-1",
      }),
      {} as never,
      vi.fn()
    );

    // triggerWorkflow should use db.transaction for insert + stats
    expect(mockDbTransaction).toHaveBeenCalledOnce();
  });
});
