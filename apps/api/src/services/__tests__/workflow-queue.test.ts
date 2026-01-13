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
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
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

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping enqueue"),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
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

// Import afterEach for cleanup
import { afterEach } from "vitest";
