/**
 * Workflow Processor Trigger Tests
 *
 * Tests the `triggerWorkflow` path via `handler(type:"trigger")`.
 * Covers: reentry delay, contact cooldown, max concurrent,
 * duplicate execution conflict, and happy-path creation + enqueue.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeExecution,
  makeSQSEvent,
  makeWorkflow,
} from "./fixtures/workflow-fixtures";

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

mockDbTransaction.mockImplementation(async (callback: Function) =>
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
  default: {
    lookup: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }),
  },
  lookup: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }),
}));

// Import handler AFTER all mocks are set up
const { handler } = await import("../workers/workflow-processor");

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDbTransaction.mockImplementation(async (callback: Function) =>
    callback({
      select: mockDbSelect,
      update: mockDbUpdate,
      insert: mockDbInsert,
    })
  );
});

const triggerJob = {
  type: "trigger" as const,
  workflowId: "wf-1",
  contactId: "contact-1",
  organizationId: "org-1",
};

describe("triggerWorkflow", () => {
  it("returns early when workflow not found", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("returns early when workflow disabled", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([makeWorkflow({ status: "paused" })]),
        }),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("skips when reentry delay is active", async () => {
    const wf = makeWorkflow({
      allowReentry: false,
      reentryDelaySeconds: 3600,
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wf]),
        }),
      }),
    });

    // db.query.workflowExecution.findFirst → found a recent completion
    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue({
      id: "exec-old",
      status: "completed",
      completedAt: new Date(),
    });

    // update for incrementDroppedExecutions
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    // Should increment dropped, not create execution
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("proceeds when reentry delay has expired", async () => {
    const wf = makeWorkflow({
      allowReentry: false,
      reentryDelaySeconds: 3600,
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wf]),
        }),
      }),
    });

    // No recent completion found → reentry delay not active
    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue(null);

    // insert execution
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "exec-new" }]),
        }),
      }),
    });

    // update workflow stats
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockEnqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execute",
        executionId: "exec-new",
        stepId: "step-1",
      })
    );
  });

  it("skips when contact cooldown is active", async () => {
    const wf = makeWorkflow({ contactCooldownSeconds: 7200 });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wf]),
        }),
      }),
    });

    // findFirst call: cooldown check → found a recent execution
    mockDbQueryWorkflowExecution.findFirst.mockResolvedValue({
      id: "exec-recent",
      createdAt: new Date(),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("skips when max concurrent reached", async () => {
    const wf = makeWorkflow({ maxConcurrentExecutions: 5 });

    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
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
      // Count query returns 5 (at limit)
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      };
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("scopes maxConcurrentExecutions count by organizationId", async () => {
    const wf = makeWorkflow({ maxConcurrentExecutions: 10 });

    // Track all eq() calls to verify org scope is included
    const { eq: realEq } = await import("@wraps/db");
    const eqCalls: Array<{ left: unknown; right: unknown }> = [];
    const eqSpy = vi.fn((...args: Parameters<typeof realEq>) => {
      eqCalls.push({ left: args[0], right: args[1] });
      return realEq(...args);
    });

    // Temporarily replace eq in the module
    const dbModule = await import("@wraps/db");
    const originalEq = dbModule.eq;
    // Replace eq for testing
    (dbModule as Record<string, unknown>).eq = eqSpy;

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
      // Count query
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      };
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockDbTransaction.mockImplementation(async (callback: Function) =>
      callback({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "exec-1" }]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      })
    );

    await handler(makeSQSEvent(triggerJob));

    // Restore eq
    // Restore eq
    (dbModule as Record<string, unknown>).eq = originalEq;

    // Verify eq was called with organizationId column for the count query.
    // The count query uses eq(workflowExecution.workflowId, ...) and should
    // also use eq(workflowExecution.organizationId, organizationId).
    const orgEqCalls = eqCalls.filter((c) => {
      const col = c.left as { name?: string };
      return col?.name === "organization_id";
    });
    // At least 2 org-scoped eq() calls: 1 for loading workflow, 1 for count query
    expect(orgEqCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("returns early when no trigger step in workflow", async () => {
    const wf = makeWorkflow({
      steps: [
        {
          id: "step-1",
          type: "webhook",
          config: { type: "webhook", url: "https://x.com", method: "POST" },
        },
      ],
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wf]),
        }),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("returns early when no first transition from trigger", async () => {
    const wf = makeWorkflow({ transitions: [] });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wf]),
        }),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("skips on duplicate execution conflict", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeWorkflow()]),
        }),
      }),
    });

    // insert returns empty → onConflictDoNothing triggered
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // incrementDroppedExecutions
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
    // Should have called update for incrementDroppedExecutions
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("happy path: creates execution, updates stats, enqueues first step", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeWorkflow()]),
        }),
      }),
    });

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

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(makeSQSEvent(triggerJob));

    // Should insert execution
    expect(mockDbInsert).toHaveBeenCalled();

    // Should update workflow stats
    expect(mockDbUpdate).toHaveBeenCalled();

    // Should enqueue the first step after trigger
    expect(mockEnqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execute",
        executionId: "exec-new",
        stepId: "step-1",
        organizationId: "org-1",
      })
    );
  });

  it("passes eventData as triggerData to execution", async () => {
    const jobWithEvent = {
      ...triggerJob,
      eventData: { source: "api", userId: "u-1" },
    };

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeWorkflow()]),
        }),
      }),
    });

    const insertValuesSpy = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "exec-new" }]),
      }),
    });
    mockDbInsert.mockReturnValue({ values: insertValuesSpy });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handler(makeSQSEvent(jobWithEvent));

    const insertedValues = insertValuesSpy.mock.calls[0][0];
    expect(insertedValues.triggerData).toEqual({
      source: "api",
      userId: "u-1",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processScheduleTrigger truncation warning
// ─────────────────────────────────────────────────────────────────────────────

describe("processScheduleTrigger — truncation warning", () => {
  const scheduleJob = {
    type: "schedule-trigger" as const,
    workflowId: "wf-1",
    organizationId: "org-1",
  };

  it("emits log.warn when contact count equals MAX_CONTACTS_PER_TRIGGER (1000)", async () => {
    const { log: mockLog } = await import("../../lib/logger");

    // Workflow with schedule trigger
    const wf = makeWorkflow({
      triggerType: "schedule",
      triggerConfig: { schedule: "0 9 * * *" },
    });

    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
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
      // contacts query: return exactly 1000 contacts
      const contacts = Array.from({ length: 1000 }, (_, i) => ({
        id: `c-${i}`,
      }));
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(contacts),
          }),
        }),
      };
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockEnqueueWorkflowStepBatch.mockResolvedValue(undefined);
    mockCreateNextWorkflowSchedule.mockResolvedValue(undefined);

    await handler(makeSQSEvent(scheduleJob));

    // log.warn must have been called with a message about truncation and the workflowId
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.stringContaining("truncat"),
      expect.objectContaining({ workflowId: "wf-1", contactCount: 1000 })
    );
  });
});
