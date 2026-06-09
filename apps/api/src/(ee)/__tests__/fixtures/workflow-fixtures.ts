/**
 * Shared test fixtures for workflow processor tests.
 *
 * Single source of truth for makeWorkflow / makeExecution / makeContact /
 * makeSQSEvent and the Drizzle query-chain mock helpers. Import from here
 * instead of copy-pasting across test files.
 */

import type { SQSEvent } from "aws-lambda";
import { type Mock, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Data factories
// ─────────────────────────────────────────────────────────────────────────────

export function makeWorkflow(overrides: Record<string, unknown> = {}) {
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
        type: "webhook",
        config: {
          type: "webhook",
          url: "https://hook.example.com",
          method: "POST",
          headers: {},
          body: {},
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
    defaultFrom: null,
    defaultFromName: null,
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

export function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    contactId: "contact-1",
    organizationId: "org-1",
    status: "active",
    currentStepId: "step-1",
    triggerData: {},
    definitionSnapshot: null,
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

export function makeContact(overrides: Record<string, unknown> = {}) {
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

export function makeSQSEvent(...bodies: Record<string, unknown>[]): SQSEvent {
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
// Drizzle query-chain mock helpers
//
// Each helper returns a fresh vi.fn() chain matching the Drizzle query shape.
// Call these inside test setup functions — not at module level — so mocks are
// always fresh per test.
// ─────────────────────────────────────────────────────────────────────────────

/** db.select().from().where().limit() */
export function selectChain(rows: unknown[]): Mock {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** db.select().from().where() — resolves directly (no .limit()) */
export function selectWhereChain(rows: unknown[]): Mock {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

/** db.select().from().where().orderBy().limit() — also supports .limit() directly after .where() */
export function selectOrderByChain(rows: unknown[]): Mock {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** db.update().set().where() — void return */
export function updateChainVoid(): Mock {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

/** db.update().set().where().returning() */
export function updateChainReturning(rows: unknown[]): Mock {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** db.insert().values().onConflictDoNothing().returning() */
export function insertChainConflictDoNothing(rows: unknown[]): Mock {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** db.insert().values().onConflictDoUpdate().returning() */
export function insertChainConflictDoUpdate(rows: unknown[]): Mock {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}
