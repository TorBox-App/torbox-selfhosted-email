/**
 * Workflow Queue Service Tests
 *
 * Tests for workflow scheduling and enqueueing functionality.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatScheduleExpression,
  generateScheduleName,
} from "../workflow-queue";

// =============================================================================
// formatScheduleExpression
// =============================================================================

describe("formatScheduleExpression", () => {
  it("should format date to EventBridge Scheduler at() expression", () => {
    const date = new Date("2026-01-08T04:37:29.148Z");
    const result = formatScheduleExpression(date);
    expect(result).toBe("at(2026-01-08T04:37:29)");
  });

  it("should strip milliseconds from ISO string", () => {
    const date = new Date("2024-12-25T12:30:45.999Z");
    const result = formatScheduleExpression(date);
    expect(result).not.toContain(".");
    expect(result).toBe("at(2024-12-25T12:30:45)");
  });

  it("should handle dates with zero milliseconds", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = formatScheduleExpression(date);
    expect(result).toBe("at(2024-01-01T00:00:00)");
  });

  it("should produce valid format for midnight", () => {
    const date = new Date("2024-06-15T00:00:00.000Z");
    const result = formatScheduleExpression(date);
    expect(result).toBe("at(2024-06-15T00:00:00)");
  });

  it("should produce valid format for end of day", () => {
    const date = new Date("2024-06-15T23:59:59.999Z");
    const result = formatScheduleExpression(date);
    expect(result).toBe("at(2024-06-15T23:59:59)");
  });

  it("should handle leap year dates", () => {
    const date = new Date("2024-02-29T12:00:00.000Z");
    const result = formatScheduleExpression(date);
    expect(result).toBe("at(2024-02-29T12:00:00)");
  });
});

// =============================================================================
// generateScheduleName
// =============================================================================

describe("generateScheduleName", () => {
  it("should generate name with prefix and truncated IDs", () => {
    const executionId = "exec-12345678-abcd-efgh-ijkl";
    const stepId = "step-87654321-wxyz-uvst-qrpo";
    const result = generateScheduleName("wraps-wf", executionId, stepId);

    expect(result).toBe("wraps-wf-exec-123-step-876");
  });

  it("should use first 8 characters of each ID", () => {
    const executionId = "abcdefgh-ijkl-mnop-qrst-uvwxyz123456";
    const stepId = "12345678-9abc-defg-hijk-lmnopqrstuvw";
    const result = generateScheduleName("prefix", executionId, stepId);

    expect(result).toBe("prefix-abcdefgh-12345678");
  });

  it("should handle different prefixes", () => {
    const executionId = "execution-id-here";
    const stepId = "step-id-here-too";

    expect(generateScheduleName("wraps-wf", executionId, stepId)).toBe(
      "wraps-wf-executio-step-id-"
    );
    expect(generateScheduleName("wraps-wf-to", executionId, stepId)).toBe(
      "wraps-wf-to-executio-step-id-"
    );
  });

  it("should produce names under 64 character limit", () => {
    const longExecutionId = "a".repeat(100);
    const longStepId = "b".repeat(100);
    const result = generateScheduleName(
      "wraps-wf",
      longExecutionId,
      longStepId
    );

    expect(result.length).toBeLessThanOrEqual(64);
  });

  it("should handle short IDs", () => {
    const shortExecId = "abc";
    const shortStepId = "xyz";
    const result = generateScheduleName("test", shortExecId, shortStepId);

    expect(result).toBe("test-abc-xyz");
  });

  it("should handle UUIDs", () => {
    const uuid1 = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const uuid2 = "550e8400-e29b-41d4-a716-446655440000";
    const result = generateScheduleName("wraps-wf", uuid1, uuid2);

    expect(result).toBe("wraps-wf-f47ac10b-550e8400");
    expect(result.length).toBeLessThanOrEqual(64);
  });
});

// =============================================================================
// WorkflowJob Types
// =============================================================================

describe("WorkflowJob type validation", () => {
  it("should accept execute job", () => {
    const job = {
      type: "execute" as const,
      executionId: "exec-123",
      stepId: "step-456",
      organizationId: "org-789",
    };

    expect(job.type).toBe("execute");
    expect(job.executionId).toBeDefined();
    expect(job.stepId).toBeDefined();
  });

  it("should accept resume job with various branches", () => {
    const branches = [
      "yes",
      "no",
      "timeout",
      "opened",
      "clicked",
      "bounced",
    ] as const;

    for (const branch of branches) {
      const job = {
        type: "resume" as const,
        executionId: "exec-123",
        branch,
        organizationId: "org-789",
      };

      expect(job.type).toBe("resume");
      expect(job.branch).toBe(branch);
    }
  });

  it("should accept trigger job with optional event data", () => {
    const jobWithoutData = {
      type: "trigger" as const,
      workflowId: "wf-123",
      contactId: "contact-456",
      organizationId: "org-789",
    };

    const jobWithData = {
      type: "trigger" as const,
      workflowId: "wf-123",
      contactId: "contact-456",
      organizationId: "org-789",
      eventData: { key: "value", nested: { data: true } },
    };

    expect(jobWithoutData.type).toBe("trigger");
    expect(jobWithData.eventData).toEqual({
      key: "value",
      nested: { data: true },
    });
  });
});

// =============================================================================
// Integration behavior tests (mocked AWS clients)
// =============================================================================

describe("enqueueWorkflowStep behavior", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should warn when queue URL not configured in dev", async () => {
    const mockWarn = vi.fn();
    vi.doMock("../../lib/logger", () => ({
      log: { info: vi.fn(), warn: mockWarn, error: vi.fn() },
    }));
    process.env.WORKFLOW_QUEUE_URL = "";
    process.env.NODE_ENV = "development";

    // Re-import to get fresh module with new env
    const { enqueueWorkflowStep } = await import("../workflow-queue");

    await enqueueWorkflowStep({
      type: "execute",
      executionId: "test",
      stepId: "step",
      organizationId: "org",
    });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping enqueue"),
      expect.any(Object)
    );
  });
});

// =============================================================================
// enqueueWorkflowStepBatch
// =============================================================================

describe("enqueueWorkflowStepBatch behavior", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should no-op for empty jobs array", async () => {
    const mockWarn = vi.fn();
    vi.doMock("../../lib/logger", () => ({
      log: { info: vi.fn(), warn: mockWarn, error: vi.fn() },
    }));
    process.env.WORKFLOW_QUEUE_URL = "";
    process.env.NODE_ENV = "development";

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");

    await enqueueWorkflowStepBatch([]);

    // Should not even warn — just returns immediately
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("should warn when queue URL not configured in dev", async () => {
    const mockWarn = vi.fn();
    vi.doMock("../../lib/logger", () => ({
      log: { info: vi.fn(), warn: mockWarn, error: vi.fn() },
    }));
    process.env.WORKFLOW_QUEUE_URL = "";
    process.env.NODE_ENV = "development";

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");

    await enqueueWorkflowStepBatch([
      {
        type: "trigger",
        workflowId: "wf-1",
        contactId: "c-1",
        organizationId: "org-1",
      },
    ]);

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping batch enqueue"),
      expect.objectContaining({ count: 1 })
    );
  });

  it("should throw when queue URL not configured in production", async () => {
    process.env.WORKFLOW_QUEUE_URL = "";
    process.env.NODE_ENV = "production";

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");

    await expect(
      enqueueWorkflowStepBatch([
        {
          type: "trigger",
          workflowId: "wf-1",
          contactId: "c-1",
          organizationId: "org-1",
        },
      ])
    ).rejects.toThrow("WORKFLOW_QUEUE_URL not configured");
  });

  it("should throw when SQS returns Failed[] with SenderFault: false (transient)", async () => {
    process.env.WORKFLOW_QUEUE_URL =
      "https://sqs.us-east-1.amazonaws.com/123/test-queue";
    process.env.NODE_ENV = "production";

    const mockSend = vi.fn().mockResolvedValue({
      Successful: [],
      Failed: [
        {
          Id: "0",
          SenderFault: false,
          Code: "InternalError",
          Message: "SQS internal error",
        },
      ],
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: vi.fn(),
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");

    await expect(
      enqueueWorkflowStepBatch([
        {
          type: "trigger",
          workflowId: "wf-1",
          contactId: "c-1",
          organizationId: "org-1",
        },
      ])
    ).rejects.toThrow(/SQS batch.*failed/i);
  });

  it("should not throw when SQS returns all Successful entries", async () => {
    process.env.WORKFLOW_QUEUE_URL =
      "https://sqs.us-east-1.amazonaws.com/123/test-queue";
    process.env.NODE_ENV = "production";

    const mockSend = vi.fn().mockResolvedValue({
      Successful: [{ Id: "0", MessageId: "msg-1", MD5OfMessageBody: "abc" }],
      Failed: [],
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: vi.fn(),
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");

    await expect(
      enqueueWorkflowStepBatch([
        {
          type: "trigger",
          workflowId: "wf-1",
          contactId: "c-1",
          organizationId: "org-1",
        },
      ])
    ).resolves.toBeUndefined();
  });
});

describe("scheduleWorkflowStep behavior", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should generate unique schedule names", async () => {
    process.env.SCHEDULER_ROLE_ARN = "";
    process.env.WORKFLOW_QUEUE_ARN = "";
    process.env.NODE_ENV = "development";

    const { scheduleWorkflowStep } = await import("../workflow-queue");

    const name1 = await scheduleWorkflowStep({
      executionId: "exec-111111111",
      stepId: "step-aaaaaaaaa",
      organizationId: "org-1",
      delaySeconds: 60,
    });

    const name2 = await scheduleWorkflowStep({
      executionId: "exec-222222222",
      stepId: "step-bbbbbbbbb",
      organizationId: "org-1",
      delaySeconds: 60,
    });

    expect(name1).not.toBe(name2);
    expect(name1).toContain("wraps-wf");
    expect(name2).toContain("wraps-wf");
  });
});

describe("scheduleWaitTimeout behavior", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use different prefix for timeout schedules", async () => {
    process.env.SCHEDULER_ROLE_ARN = "";
    process.env.WORKFLOW_QUEUE_ARN = "";
    process.env.NODE_ENV = "development";

    const { scheduleWaitTimeout } = await import("../workflow-queue");

    const name = await scheduleWaitTimeout({
      executionId: "exec-123",
      stepId: "step-456",
      organizationId: "org-1",
      timeoutSeconds: 3600,
    });

    expect(name).toContain("wraps-wf-to");
  });
});

// =============================================================================
// enqueueWorkflowStepBatch — partial failure retry logic
// =============================================================================

describe("enqueueWorkflowStepBatch — partial failure retry logic", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    process.env = {
      ...originalEnv,
      WORKFLOW_QUEUE_URL:
        "https://sqs.us-east-1.amazonaws.com/123456/test-queue",
      NODE_ENV: "production",
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it("throws immediately on permanent failure (SenderFault=true) without retrying", async () => {
    const mockSend = vi.fn().mockResolvedValue({
      Successful: [],
      Failed: [
        {
          Id: "0",
          SenderFault: true,
          Code: "InvalidParameterValue",
          Message: "Message is too large",
        },
      ],
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: vi.fn(),
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");
    const promise = enqueueWorkflowStepBatch([
      {
        type: "trigger",
        workflowId: "wf-1",
        contactId: "c-1",
        organizationId: "org-1",
      },
    ]);
    // Attach rejection handler before advancing timers to avoid unhandled rejection warning
    const expectation = expect(promise).rejects.toThrow(/permanently failed/);
    await vi.runAllTimersAsync();
    await expectation;
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("resolves without error when transient failure succeeds on first retry", async () => {
    let callCount = 0;
    const mockSend = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          Successful: [],
          Failed: [{ Id: "0", SenderFault: false, Code: "InternalError" }],
        });
      }
      return Promise.resolve({
        Successful: [{ Id: "0", MessageId: "msg-ok" }],
        Failed: [],
      });
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: vi.fn(),
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");
    const promise = enqueueWorkflowStepBatch([
      {
        type: "trigger",
        workflowId: "wf-1",
        contactId: "c-1",
        organizationId: "org-1",
      },
    ]);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all 3 attempts on persistent transient failure", async () => {
    const mockSend = vi.fn().mockResolvedValue({
      Successful: [],
      Failed: [{ Id: "0", SenderFault: false, Code: "InternalError" }],
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: vi.fn(),
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");
    const promise = enqueueWorkflowStepBatch([
      {
        type: "trigger",
        workflowId: "wf-1",
        contactId: "c-1",
        organizationId: "org-1",
      },
    ]);
    // Attach rejection handler before advancing timers to avoid unhandled rejection warning
    const expectation = expect(promise).rejects.toThrow(
      /failed after 3 attempts/
    );
    await vi.runAllTimersAsync();
    await expectation;
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("retries only the specific failed job IDs, not the successful ones", async () => {
    const job1 = {
      type: "trigger" as const,
      workflowId: "wf-1",
      contactId: "c-1",
      organizationId: "org-1",
    };
    const job2 = {
      type: "trigger" as const,
      workflowId: "wf-2",
      contactId: "c-2",
      organizationId: "org-1",
    };
    const job3 = {
      type: "trigger" as const,
      workflowId: "wf-3",
      contactId: "c-3",
      organizationId: "org-1",
    };

    let callCount = 0;
    const MockBatchCommand = vi.fn();
    const mockSend = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // job2 (index 1) fails transiently; job1 and job3 succeed
        return Promise.resolve({
          Successful: [
            { Id: "0", MessageId: "msg-1" },
            { Id: "2", MessageId: "msg-3" },
          ],
          Failed: [{ Id: "1", SenderFault: false, Code: "InternalError" }],
        });
      }
      return Promise.resolve({
        Successful: [{ Id: "0", MessageId: "msg-retry" }],
        Failed: [],
      });
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: MockBatchCommand,
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");
    const promise = enqueueWorkflowStepBatch([job1, job2, job3]);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(2);

    // The retry call (2nd constructor call) should contain only job2 — not job1 or job3
    const retryParams = MockBatchCommand.mock.calls[1][0] as {
      Entries: { Id: string; MessageBody: string }[];
    };
    expect(retryParams.Entries).toHaveLength(1);
    expect(JSON.parse(retryParams.Entries[0].MessageBody)).toEqual(job2);
  });

  it("logs a warning with attempt number and retry count on transient retry", async () => {
    const mockWarn = vi.fn();
    vi.doMock("../../lib/logger", () => ({
      log: { info: vi.fn(), warn: mockWarn, error: vi.fn() },
    }));

    let callCount = 0;
    const mockSend = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          Successful: [],
          Failed: [{ Id: "0", SenderFault: false, Code: "InternalError" }],
        });
      }
      return Promise.resolve({
        Successful: [{ Id: "0", MessageId: "msg-ok" }],
        Failed: [],
      });
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: vi.fn(),
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");
    const promise = enqueueWorkflowStepBatch([
      {
        type: "trigger",
        workflowId: "wf-1",
        contactId: "c-1",
        organizationId: "org-1",
      },
    ]);
    await vi.runAllTimersAsync();
    await promise;

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("retrying"),
      expect.objectContaining({ attempt: 1, retryCount: 1 })
    );
  });

  it("chunks >10 jobs correctly and only retries failures from each chunk", async () => {
    const jobs = Array.from({ length: 12 }, (_, i) => ({
      type: "trigger" as const,
      workflowId: `wf-${i}`,
      contactId: `c-${i}`,
      organizationId: "org-1",
    }));

    let callCount = 0;
    const MockBatchCommand = vi.fn();
    const mockSend = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First chunk (jobs 0-9): job at index 3 fails transiently
        return Promise.resolve({
          Successful: [0, 1, 2, 4, 5, 6, 7, 8, 9].map((i) => ({
            Id: String(i),
            MessageId: `msg-${i}`,
          })),
          Failed: [{ Id: "3", SenderFault: false, Code: "InternalError" }],
        });
      }
      // Second chunk (jobs 10-11) and retry: all succeed
      return Promise.resolve({
        Successful: [{ Id: "0", MessageId: "msg-ok" }],
        Failed: [],
      });
    });
    vi.doMock("@aws-sdk/client-sqs", () => ({
      SQSClient: class {
        send = mockSend;
      },
      SendMessageBatchCommand: MockBatchCommand,
      SendMessageCommand: vi.fn(),
    }));

    const { enqueueWorkflowStepBatch } = await import("../workflow-queue");
    const promise = enqueueWorkflowStepBatch(jobs);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
    // chunk1 + chunk2 + retry-of-failed = 3 SQS calls
    expect(mockSend).toHaveBeenCalledTimes(3);

    // The retry call (3rd constructor call) should contain only jobs[3]
    const retryParams = MockBatchCommand.mock.calls[2][0] as {
      Entries: { Id: string; MessageBody: string }[];
    };
    expect(retryParams.Entries).toHaveLength(1);
    expect(JSON.parse(retryParams.Entries[0].MessageBody)).toEqual(jobs[3]);
  });
});

// Import afterEach for cleanup
import { afterEach } from "vitest";
