/**
 * Workflow Processor Transition Routing Tests
 *
 * Tests `processNextStep` routing logic via the SQS handler:
 * - Branch-specific transitions (condition step -> "yes"/"no" branch)
 * - Branchless fallback when branch has no matching transition
 * - Terminal completion when no transitions leave the current step
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeContact,
  makeExecution,
  makeSQSEvent,
  makeWorkflow,
} from "./fixtures/workflow-fixtures";

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

// ═══════════════════════════════════════════════════════════════════════════
// Suite: Atomic claim guard on processStep (Chunk 2 Items 1 & 3)
// ═══════════════════════════════════════════════════════════════════════════

describe("processStep atomic claim guard", () => {
  const executeJob = {
    type: "execute" as const,
    executionId: "exec-1",
    stepId: "step-cond",
    organizationId: "org-1",
  };

  // Unit 10: processStep exits without side effects when execution status is cancelled
  it("exits without side effects when execution status is cancelled", async () => {
    const { log } = await import("../../lib/logger");

    // findFirst returns a cancelled execution
    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue(
      makeExecution({ status: "cancelled", currentStepId: "step-cond" })
    );

    // The atomic UPDATE (WHERE ... AND status NOT IN ...) finds no row to claim
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // selects: workflow + contact available but should NOT be reached
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeWorkflow()]),
        }),
      }),
    }));

    await handler(makeSQSEvent(executeJob));

    // No step should have been enqueued
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
    expect(mockEnqueueWorkflowStepBatch).not.toHaveBeenCalled();
    // log.info should be called (fast-path pre-flight for terminal execution)
    expect(log.info).toHaveBeenCalledWith(
      expect.stringMatching(/stale|cancelled|terminal|already|claimed/i),
      expect.anything()
    );
  });

  // Unit 11: processStep continues normally when execution status is paused
  it("continues normally when execution status is paused", async () => {
    const wf = makeWorkflow({
      steps: [
        { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
        {
          id: "step-cond",
          type: "webhook",
          config: {
            type: "webhook",
            url: "https://hook.example.com",
            method: "POST",
          },
        },
      ],
      transitions: [
        {
          id: "t1",
          fromStepId: "trigger-1",
          toStepId: "step-cond",
          condition: null,
        },
      ],
    });

    // findFirst returns a paused execution (valid to resume via SQS message)
    const pausedExecution = makeExecution({
      status: "paused",
      currentStepId: "step-cond",
    });
    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue(pausedExecution);

    // The atomic UPDATE succeeds — paused is not in the terminal exclusion list
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([pausedExecution]),
        }),
      }),
    });

    let selectCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockReturnValue({ limit: vi.fn().mockResolvedValue([wf]) }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([makeContact()]),
          }),
        }),
      };
    });

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "se-1", status: "executing" }]),
        }),
      }),
    });

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    await handler(makeSQSEvent(executeJob));

    // fetch should have been called — step executed
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Suite: Multi-step chain routing
// Verifies that after completing step-A the processor routes to step-B,
// not directly to step-C. This catches off-by-one bugs in transition lookup.
// ═══════════════════════════════════════════════════════════════════════════

describe("multi-step chain routing", () => {
  it("routes A→B when processing A, not A→C", async () => {
    // Chain: trigger-1 → step-a (webhook) → step-b (webhook) → step-c (webhook)
    setupProcessStep({
      execution: { currentStepId: "step-a" },
      workflow: {
        steps: [
          { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
          {
            id: "step-a",
            type: "webhook",
            config: {
              type: "webhook",
              url: "https://a.example.com",
              method: "POST",
            },
          },
          {
            id: "step-b",
            type: "webhook",
            config: {
              type: "webhook",
              url: "https://b.example.com",
              method: "POST",
            },
          },
          {
            id: "step-c",
            type: "webhook",
            config: {
              type: "webhook",
              url: "https://c.example.com",
              method: "POST",
            },
          },
        ],
        transitions: [
          {
            id: "t1",
            fromStepId: "trigger-1",
            toStepId: "step-a",
            condition: null,
          },
          {
            id: "t2",
            fromStepId: "step-a",
            toStepId: "step-b",
            condition: null,
          },
          {
            id: "t3",
            fromStepId: "step-b",
            toStepId: "step-c",
            condition: null,
          },
        ],
      },
    });

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    await handler(
      makeSQSEvent({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-a",
        organizationId: "org-1",
      })
    );

    // Should enqueue step-b only — NOT step-c
    expect(mockEnqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ type: "execute", stepId: "step-b" })
    );
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalledWith(
      expect.objectContaining({ stepId: "step-c" })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Suite: Condition with no matching transition → terminal completion
// When a condition step resolves "yes" but only a "no" transition (and no
// branchless fallback) exists, the execution has nowhere to go and must
// complete rather than enqueue any step.
// ═══════════════════════════════════════════════════════════════════════════

describe("condition step with no matching transition", () => {
  it("completes execution when condition resolves yes but only no-branch transition exists", async () => {
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
              value: "gold", // evaluates to "yes"
            },
          },
          {
            id: "step-no-path",
            type: "webhook",
            config: {
              type: "webhook",
              url: "https://no.example.com",
              method: "POST",
            },
          },
        ],
        // Only "no" branch transition — condition evaluates "yes" so no match,
        // and there is no branchless fallback either.
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
            toStepId: "step-no-path",
            condition: { branch: "no" },
          },
        ],
      },
    });

    await handler(
      makeSQSEvent({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-cond",
        organizationId: "org-1",
      })
    );

    // No next step enqueued — dead end reached
    const executeEnqueues = mockEnqueueWorkflowStep.mock.calls.filter(
      (call) => (call[0] as { type?: string }).type === "execute"
    );
    expect(executeEnqueues).toHaveLength(0);
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalledWith(
      expect.objectContaining({ stepId: "step-no-path" })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Suite: Definition snapshot fallback
// When execution.definitionSnapshot is set, the processor uses snapshot
// steps/transitions for routing instead of the live workflow definition.
// This verifies in-flight executions are immune to live dashboard edits.
// ═══════════════════════════════════════════════════════════════════════════

describe("definition snapshot fallback", () => {
  it("uses snapshot steps and transitions, not live workflow definition", async () => {
    // Live workflow has: trigger-1 → step-live (only one step)
    // Snapshot has: trigger-1 → step-snap → step-after (two steps)
    // Processing step-snap should route to step-after (snapshot), not dead-end (live).

    const snapshot = {
      version: 1,
      steps: [
        { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
        {
          id: "step-snap",
          type: "webhook",
          config: {
            type: "webhook",
            url: "https://snap.example.com",
            method: "POST",
          },
        },
        {
          id: "step-after",
          type: "webhook",
          config: {
            type: "webhook",
            url: "https://after.example.com",
            method: "POST",
          },
        },
      ],
      transitions: [
        {
          id: "t1",
          fromStepId: "trigger-1",
          toStepId: "step-snap",
          condition: null,
        },
        {
          id: "t2",
          fromStepId: "step-snap",
          toStepId: "step-after",
          condition: null,
        },
      ],
    };

    setupProcessStep({
      execution: {
        currentStepId: "step-snap",
        definitionSnapshot: snapshot,
      },
      workflow: {
        // Live definition has step-snap but NO outgoing transition from it
        steps: [
          { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
          {
            id: "step-snap",
            type: "webhook",
            config: {
              type: "webhook",
              url: "https://snap.example.com",
              method: "POST",
            },
          },
        ],
        transitions: [
          {
            id: "t1",
            fromStepId: "trigger-1",
            toStepId: "step-snap",
            condition: null,
          },
          // Intentionally NO transition from step-snap — if live def is used, execution completes
        ],
      },
    });

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    await handler(
      makeSQSEvent({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-snap",
        organizationId: "org-1",
      })
    );

    // If snapshot is used → step-after enqueued
    // If live def is used → no step enqueued (dead-end completion)
    expect(mockEnqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ type: "execute", stepId: "step-after" })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Suite: Execution lifetime expiry
// Executions older than 30 days must be failed when processStep runs on them.
// The EXECUTION_LIFETIME_MS check happens after the atomic claim succeeds.
// ═══════════════════════════════════════════════════════════════════════════

describe("execution lifetime expiry", () => {
  it("fails execution when createdAt is more than 30 days ago", async () => {
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    const staleCreatedAt = new Date(Date.now() - THIRTY_ONE_DAYS_MS);

    // findFirst: pre-flight check returns the stale execution (not terminal)
    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue(
      makeExecution({
        status: "active",
        currentStepId: "step-1",
        createdAt: staleCreatedAt,
      })
    );

    // Atomic claim UPDATE succeeds and returns the stale execution
    const staleExec = makeExecution({
      status: "active",
      currentStepId: "step-1",
      createdAt: staleCreatedAt,
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([staleExec]),
        }),
      }),
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeWorkflow()]),
        }),
      }),
    });

    // insert: step execution claim
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "se-1",
              status: "executing",
              idempotencyKey: "exec-1-step-1",
            },
          ]),
        }),
      }),
    });

    mockDbTransaction.mockImplementation(async (callback: Function) =>
      callback({
        select: mockDbSelect,
        update: mockDbUpdate,
        insert: mockDbInsert,
      })
    );

    await handler(
      makeSQSEvent({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-1",
        organizationId: "org-1",
      })
    );

    // failExecution was called: verify the execution status update to "failed"
    // failExecution does a db.transaction with update.set({ status: "failed", ... })
    const allSetCalls = mockDbUpdate.mock.results.flatMap(
      (r) => r.value?.set?.mock?.calls ?? []
    ) as unknown[][];
    const failedUpdate = allSetCalls.find(
      ([arg]) => (arg as Record<string, unknown>)?.status === "failed"
    );
    expect(failedUpdate).toBeDefined();

    // No step should have been dispatched to the next step
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "execute" })
    );
  });

  it("does not fail execution when createdAt is within the 30-day window", async () => {
    const TWENTY_NINE_DAYS_MS = 29 * 24 * 60 * 60 * 1000;
    const recentCreatedAt = new Date(Date.now() - TWENTY_NINE_DAYS_MS);

    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue(
      makeExecution({
        status: "active",
        currentStepId: "step-1",
        createdAt: recentCreatedAt,
      })
    );

    // Atomic claim returns the recent execution
    const recentExec = makeExecution({
      status: "active",
      currentStepId: "step-1",
      createdAt: recentCreatedAt,
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([recentExec]),
        }),
      }),
    });

    const wf = makeWorkflow({
      steps: [
        { id: "trigger-1", type: "trigger", config: { type: "trigger" } },
        {
          id: "step-1",
          type: "webhook",
          config: {
            type: "webhook",
            url: "https://hook.example.com",
            method: "POST",
          },
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
    });

    let selectCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCount++;
      const rows = selectCount === 1 ? [wf] : [makeContact()];
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
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
              idempotencyKey: "exec-1-step-1",
            },
          ]),
        }),
      }),
    });

    mockDbTransaction.mockImplementation(async (callback: Function) =>
      callback({
        select: mockDbSelect,
        update: mockDbUpdate,
        insert: mockDbInsert,
      })
    );

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    await handler(
      makeSQSEvent({
        type: "execute",
        executionId: "exec-1",
        stepId: "step-1",
        organizationId: "org-1",
      })
    );

    // Execution is still alive — step ran (fetch called)
    expect(mockFetch).toHaveBeenCalledOnce();

    // No "failed" status update
    const allSetCalls = mockDbUpdate.mock.results.flatMap(
      (r) => r.value?.set?.mock?.calls ?? []
    ) as unknown[][];
    const failedUpdate = allSetCalls.find(
      ([arg]) => (arg as Record<string, unknown>)?.status === "failed"
    );
    expect(failedUpdate).toBeUndefined();
  });
});
