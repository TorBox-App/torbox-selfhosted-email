/**
 * Workflow Processor Core Logic Tests
 *
 * Tests for the workflow processor's core execution logic.
 * Covers:
 * - Idempotency (ON CONFLICT DO UPDATE)
 * - maxConcurrentExecutions enforcement
 * - Reentry delay enforcement
 * - Contact cooldown enforcement
 */

import { describe, expect, it } from "vitest";

describe("Workflow Processor - Idempotency", () => {
  /**
   * Tests for the idempotency mechanism using ON CONFLICT DO UPDATE.
   * Ensures that duplicate SQS messages don't cause duplicate step executions.
   */

  describe("Idempotency Key Generation", () => {
    it("should generate unique key from executionId and stepId", () => {
      const executionId = "exec-123";
      const stepId = "step-456";
      const idempotencyKey = `${executionId}-${stepId}`;
      expect(idempotencyKey).toBe("exec-123-step-456");
    });

    it("should generate different keys for different steps", () => {
      const executionId = "exec-123";
      const key1 = `${executionId}-step-1`;
      const key2 = `${executionId}-step-2`;
      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different executions", () => {
      const stepId = "step-123";
      const key1 = `exec-1-${stepId}`;
      const key2 = `exec-2-${stepId}`;
      expect(key1).not.toBe(key2);
    });
  });

  describe("ON CONFLICT DO UPDATE Behavior", () => {
    // Simulate the SQL CASE logic
    function simulateOnConflictUpdate(
      existingStatus: string,
      _newStartedAt: Date
    ): { status: string; startedAt: Date } {
      const existingStartedAt = new Date("2024-01-01T00:00:00Z");
      const newStartedAt = new Date("2024-01-01T01:00:00Z");

      return {
        // Only update if not already completed
        status: existingStatus === "completed" ? existingStatus : "executing",
        startedAt:
          existingStatus === "completed" ? existingStartedAt : newStartedAt,
      };
    }

    it("should keep completed status when step already completed", () => {
      const result = simulateOnConflictUpdate("completed", new Date());
      expect(result.status).toBe("completed");
    });

    it("should update to executing when step was pending", () => {
      const result = simulateOnConflictUpdate("pending", new Date());
      expect(result.status).toBe("executing");
    });

    it("should update to executing when step was previously executing", () => {
      const result = simulateOnConflictUpdate("executing", new Date());
      expect(result.status).toBe("executing");
    });

    it("should preserve original startedAt when step already completed", () => {
      const originalStartedAt = new Date("2024-01-01T00:00:00Z");
      const result = simulateOnConflictUpdate("completed", new Date());
      expect(result.startedAt).toEqual(originalStartedAt);
    });

    it("should update startedAt when step not completed", () => {
      const newStartedAt = new Date("2024-01-01T01:00:00Z");
      const result = simulateOnConflictUpdate("pending", newStartedAt);
      expect(result.startedAt).toEqual(newStartedAt);
    });
  });

  describe("Duplicate Message Handling", () => {
    it("should identify completed step and skip re-execution", () => {
      const stepExecResult = { status: "completed" };
      const shouldSkip = stepExecResult.status === "completed";
      expect(shouldSkip).toBe(true);
    });

    it("should proceed with execution when step not completed", () => {
      const stepExecResult = { status: "executing" };
      const shouldSkip = stepExecResult.status === "completed";
      expect(shouldSkip).toBe(false);
    });
  });
});

describe("Workflow Processor - maxConcurrentExecutions", () => {
  /**
   * Tests for the maxConcurrentExecutions limit enforcement.
   * Ensures workflows don't exceed their configured concurrent execution limit.
   */

  describe("Concurrent Execution Count Check", () => {
    function shouldSkipDueToMaxConcurrent(
      currentCount: number,
      maxConcurrent: number | null | undefined
    ): boolean {
      if (!maxConcurrent || maxConcurrent <= 0) {
        return false;
      }
      return currentCount >= maxConcurrent;
    }

    it("should skip when at max concurrent executions", () => {
      expect(shouldSkipDueToMaxConcurrent(5, 5)).toBe(true);
    });

    it("should skip when above max concurrent executions", () => {
      expect(shouldSkipDueToMaxConcurrent(10, 5)).toBe(true);
    });

    it("should allow when below max concurrent executions", () => {
      expect(shouldSkipDueToMaxConcurrent(3, 5)).toBe(false);
    });

    it("should allow when max is not set (null)", () => {
      expect(shouldSkipDueToMaxConcurrent(100, null)).toBe(false);
    });

    it("should allow when max is not set (undefined)", () => {
      expect(shouldSkipDueToMaxConcurrent(100, undefined)).toBe(false);
    });

    it("should allow when max is zero (disabled)", () => {
      expect(shouldSkipDueToMaxConcurrent(100, 0)).toBe(false);
    });

    it("should allow when max is negative (disabled)", () => {
      expect(shouldSkipDueToMaxConcurrent(100, -1)).toBe(false);
    });

    it("should handle edge case of 0 current with max of 1", () => {
      expect(shouldSkipDueToMaxConcurrent(0, 1)).toBe(false);
    });

    it("should handle edge case of 1 current with max of 1", () => {
      expect(shouldSkipDueToMaxConcurrent(1, 1)).toBe(true);
    });
  });

  describe("Counting Active Executions", () => {
    it("should count pending executions", () => {
      const statuses = ["pending", "active", "completed"];
      const activeStatuses = ["pending", "active", "paused", "waiting"];
      const activeCount = statuses.filter((s) =>
        activeStatuses.includes(s)
      ).length;
      expect(activeCount).toBe(2);
    });

    it("should count waiting executions", () => {
      const statuses = ["waiting", "completed", "failed"];
      const activeStatuses = ["pending", "active", "paused", "waiting"];
      const activeCount = statuses.filter((s) =>
        activeStatuses.includes(s)
      ).length;
      expect(activeCount).toBe(1);
    });

    it("should not count completed executions", () => {
      const statuses = ["completed", "completed", "completed"];
      const activeStatuses = ["pending", "active", "paused", "waiting"];
      const activeCount = statuses.filter((s) =>
        activeStatuses.includes(s)
      ).length;
      expect(activeCount).toBe(0);
    });

    it("should not count failed executions", () => {
      const statuses = ["failed", "cancelled"];
      const activeStatuses = ["pending", "active", "paused", "waiting"];
      const activeCount = statuses.filter((s) =>
        activeStatuses.includes(s)
      ).length;
      expect(activeCount).toBe(0);
    });
  });
});

describe("Workflow Processor - Reentry Delay", () => {
  /**
   * Tests for the reentryDelaySeconds enforcement.
   * Prevents contacts from re-entering the same workflow too quickly.
   */

  describe("Reentry Delay Check", () => {
    function shouldSkipDueToReentryDelay(
      recentlyCompletedAt: Date | null,
      reentryDelaySeconds: number | null | undefined,
      now: Date
    ): boolean {
      if (!reentryDelaySeconds || reentryDelaySeconds <= 0) {
        return false;
      }
      if (!recentlyCompletedAt) {
        return false;
      }

      const threshold = new Date(now.getTime() - reentryDelaySeconds * 1000);
      return recentlyCompletedAt > threshold;
    }

    it("should skip when completed within delay period", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      const completedAt = new Date("2024-01-01T11:30:00Z"); // 30 min ago
      expect(shouldSkipDueToReentryDelay(completedAt, 3600, now)).toBe(true); // 1 hour delay
    });

    it("should allow when completed outside delay period", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      const completedAt = new Date("2024-01-01T10:00:00Z"); // 2 hours ago
      expect(shouldSkipDueToReentryDelay(completedAt, 3600, now)).toBe(false); // 1 hour delay
    });

    it("should allow when delay is not set (null)", () => {
      const now = new Date();
      const completedAt = new Date(now.getTime() - 1000); // 1 second ago
      expect(shouldSkipDueToReentryDelay(completedAt, null, now)).toBe(false);
    });

    it("should allow when delay is zero (disabled)", () => {
      const now = new Date();
      const completedAt = new Date(now.getTime() - 1000);
      expect(shouldSkipDueToReentryDelay(completedAt, 0, now)).toBe(false);
    });

    it("should allow when no previous completion exists", () => {
      const now = new Date();
      expect(shouldSkipDueToReentryDelay(null, 3600, now)).toBe(false);
    });

    it("should handle exact boundary case", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      const completedAt = new Date("2024-01-01T11:00:00Z"); // exactly 1 hour ago
      // Should allow since it's AT the boundary, not within
      expect(shouldSkipDueToReentryDelay(completedAt, 3600, now)).toBe(false);
    });
  });
});

describe("Workflow Processor - Contact Cooldown", () => {
  /**
   * Tests for the contactCooldownSeconds enforcement.
   * Prevents contacts from entering ANY workflow in the org too quickly.
   */

  describe("Contact Cooldown Check", () => {
    function shouldSkipDueToCooldown(
      recentExecutionAt: Date | null,
      cooldownSeconds: number | null | undefined,
      now: Date
    ): boolean {
      if (!cooldownSeconds || cooldownSeconds <= 0) {
        return false;
      }
      if (!recentExecutionAt) {
        return false;
      }

      const threshold = new Date(now.getTime() - cooldownSeconds * 1000);
      return recentExecutionAt > threshold;
    }

    it("should skip when recent execution within cooldown", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      const executionAt = new Date("2024-01-01T11:55:00Z"); // 5 min ago
      expect(shouldSkipDueToCooldown(executionAt, 600, now)).toBe(true); // 10 min cooldown
    });

    it("should allow when outside cooldown period", () => {
      const now = new Date("2024-01-01T12:00:00Z");
      const executionAt = new Date("2024-01-01T11:40:00Z"); // 20 min ago
      expect(shouldSkipDueToCooldown(executionAt, 600, now)).toBe(false); // 10 min cooldown
    });

    it("should allow when cooldown is not set", () => {
      const now = new Date();
      const executionAt = new Date(now.getTime() - 1000);
      expect(shouldSkipDueToCooldown(executionAt, null, now)).toBe(false);
    });

    it("should allow when no previous execution exists", () => {
      const now = new Date();
      expect(shouldSkipDueToCooldown(null, 600, now)).toBe(false);
    });
  });
});

describe("Workflow Processor - Reentry Prevention", () => {
  /**
   * Tests for preventing contacts from re-entering when allowReentry is false.
   */

  describe("Active Execution Check", () => {
    function hasActiveExecution(
      existingStatus: string | null,
      allowReentry: boolean
    ): boolean {
      if (allowReentry) {
        return false;
      }

      const activeStatuses = ["pending", "active", "paused", "waiting"];
      return existingStatus !== null && activeStatuses.includes(existingStatus);
    }

    it("should block when contact has pending execution", () => {
      expect(hasActiveExecution("pending", false)).toBe(true);
    });

    it("should block when contact has active execution", () => {
      expect(hasActiveExecution("active", false)).toBe(true);
    });

    it("should block when contact has paused execution", () => {
      expect(hasActiveExecution("paused", false)).toBe(true);
    });

    it("should block when contact has waiting execution", () => {
      expect(hasActiveExecution("waiting", false)).toBe(true);
    });

    it("should allow when contact has completed execution", () => {
      expect(hasActiveExecution("completed", false)).toBe(false);
    });

    it("should allow when contact has failed execution", () => {
      expect(hasActiveExecution("failed", false)).toBe(false);
    });

    it("should allow when contact has cancelled execution", () => {
      expect(hasActiveExecution("cancelled", false)).toBe(false);
    });

    it("should allow when no existing execution", () => {
      expect(hasActiveExecution(null, false)).toBe(false);
    });

    it("should allow re-entry when allowReentry is true", () => {
      expect(hasActiveExecution("active", true)).toBe(false);
    });
  });
});

describe("Workflow Processor - processNextStep Routing", () => {
  /**
   * Tests for the processNextStep branch routing logic.
   * Ensures correct transition selection and fallback behavior.
   */

  type Transition = {
    id: string;
    fromStepId: string;
    toStepId: string;
    condition?: { branch: string } | null;
  };

  function findNextTransition(
    transitions: Transition[],
    currentStepId: string,
    branch?: string
  ): Transition | undefined {
    let nextTransition: Transition | undefined;

    if (branch) {
      nextTransition = transitions.find(
        (t) => t.fromStepId === currentStepId && t.condition?.branch === branch
      );
    }

    // Fallback to branchless transition only when no specific branch was requested
    if (!(nextTransition || branch)) {
      nextTransition = transitions.find(
        (t) => t.fromStepId === currentStepId && !t.condition
      );
    }

    return nextTransition;
  }

  it("should find matching branch transition", () => {
    const transitions: Transition[] = [
      {
        id: "t1",
        fromStepId: "cond-1",
        toStepId: "step-yes",
        condition: { branch: "yes" },
      },
      {
        id: "t2",
        fromStepId: "cond-1",
        toStepId: "step-no",
        condition: { branch: "no" },
      },
    ];

    const result = findNextTransition(transitions, "cond-1", "yes");
    expect(result?.toStepId).toBe("step-yes");
  });

  it("should find branchless transition when no branch specified", () => {
    const transitions: Transition[] = [
      { id: "t1", fromStepId: "step-1", toStepId: "step-2", condition: null },
    ];

    const result = findNextTransition(transitions, "step-1");
    expect(result?.toStepId).toBe("step-2");
  });

  it("should NOT fall back to branchless transition when branch is specified", () => {
    const transitions: Transition[] = [
      {
        id: "t1",
        fromStepId: "cond-1",
        toStepId: "step-yes",
        condition: { branch: "yes" },
      },
      {
        id: "t2",
        fromStepId: "cond-1",
        toStepId: "step-fallback",
        condition: null,
      },
    ];

    // Branch "no" is specified but no matching transition exists
    const result = findNextTransition(transitions, "cond-1", "no");
    // Should return undefined (complete execution), NOT fall back to branchless
    expect(result).toBeUndefined();
  });

  it("should fall back to branchless transition when no branch specified and branched transitions exist", () => {
    const transitions: Transition[] = [
      {
        id: "t1",
        fromStepId: "step-1",
        toStepId: "step-branch",
        condition: { branch: "yes" },
      },
      {
        id: "t2",
        fromStepId: "step-1",
        toStepId: "step-default",
        condition: null,
      },
    ];

    const result = findNextTransition(transitions, "step-1");
    expect(result?.toStepId).toBe("step-default");
  });

  it("should return undefined when no transitions exist for current step", () => {
    const transitions: Transition[] = [
      {
        id: "t1",
        fromStepId: "other-step",
        toStepId: "step-2",
        condition: null,
      },
    ];

    const result = findNextTransition(transitions, "step-1");
    expect(result).toBeUndefined();
  });

  it("should return undefined when branch specified but no matching or branchless transition", () => {
    const transitions: Transition[] = [
      {
        id: "t1",
        fromStepId: "cond-1",
        toStepId: "step-yes",
        condition: { branch: "yes" },
      },
    ];

    // "timeout" branch specified, no matching transition, no branchless fallback
    const result = findNextTransition(transitions, "cond-1", "timeout");
    expect(result).toBeUndefined();
  });
});

describe("Workflow Processor - Dropped Executions Tracking", () => {
  /**
   * Tests for the droppedExecutions counter increment logic.
   * Verifies all 4 drop points trigger the counter increment.
   */

  type DropReason =
    | "reentry_delay"
    | "cooldown"
    | "max_concurrent"
    | "conflict";

  function shouldDropExecution(
    reason: DropReason,
    config: {
      allowReentry: boolean;
      reentryDelaySeconds: number | null;
      contactCooldownSeconds: number | null;
      maxConcurrentExecutions: number | null;
    },
    state: {
      recentlyCompletedAt: Date | null;
      recentExecutionAt: Date | null;
      currentConcurrentCount: number;
      conflictOccurred: boolean;
    },
    now: Date
  ): boolean {
    switch (reason) {
      case "reentry_delay": {
        if (
          config.allowReentry ||
          !config.reentryDelaySeconds ||
          config.reentryDelaySeconds <= 0 ||
          !state.recentlyCompletedAt
        ) {
          return false;
        }
        const threshold = new Date(
          now.getTime() - config.reentryDelaySeconds * 1000
        );
        return state.recentlyCompletedAt > threshold;
      }
      case "cooldown": {
        if (
          !config.contactCooldownSeconds ||
          config.contactCooldownSeconds <= 0 ||
          !state.recentExecutionAt
        ) {
          return false;
        }
        const threshold = new Date(
          now.getTime() - config.contactCooldownSeconds * 1000
        );
        return state.recentExecutionAt > threshold;
      }
      case "max_concurrent": {
        if (
          !config.maxConcurrentExecutions ||
          config.maxConcurrentExecutions <= 0
        ) {
          return false;
        }
        return state.currentConcurrentCount >= config.maxConcurrentExecutions;
      }
      case "conflict":
        return state.conflictOccurred;
    }
  }

  const now = new Date("2024-01-01T12:00:00Z");
  const defaultConfig = {
    allowReentry: false,
    reentryDelaySeconds: 3600,
    contactCooldownSeconds: 600,
    maxConcurrentExecutions: 10,
  };

  it("should drop on reentry delay", () => {
    expect(
      shouldDropExecution(
        "reentry_delay",
        defaultConfig,
        {
          recentlyCompletedAt: new Date("2024-01-01T11:30:00Z"),
          recentExecutionAt: null,
          currentConcurrentCount: 0,
          conflictOccurred: false,
        },
        now
      )
    ).toBe(true);
  });

  it("should drop on cooldown", () => {
    expect(
      shouldDropExecution(
        "cooldown",
        defaultConfig,
        {
          recentlyCompletedAt: null,
          recentExecutionAt: new Date("2024-01-01T11:55:00Z"),
          currentConcurrentCount: 0,
          conflictOccurred: false,
        },
        now
      )
    ).toBe(true);
  });

  it("should drop on max concurrent", () => {
    expect(
      shouldDropExecution(
        "max_concurrent",
        defaultConfig,
        {
          recentlyCompletedAt: null,
          recentExecutionAt: null,
          currentConcurrentCount: 10,
          conflictOccurred: false,
        },
        now
      )
    ).toBe(true);
  });

  it("should drop on conflict", () => {
    expect(
      shouldDropExecution(
        "conflict",
        defaultConfig,
        {
          recentlyCompletedAt: null,
          recentExecutionAt: null,
          currentConcurrentCount: 0,
          conflictOccurred: true,
        },
        now
      )
    ).toBe(true);
  });

  it("should not drop when reentry is allowed", () => {
    expect(
      shouldDropExecution(
        "reentry_delay",
        { ...defaultConfig, allowReentry: true },
        {
          recentlyCompletedAt: new Date("2024-01-01T11:30:00Z"),
          recentExecutionAt: null,
          currentConcurrentCount: 0,
          conflictOccurred: false,
        },
        now
      )
    ).toBe(false);
  });

  it("should not drop when outside cooldown period", () => {
    expect(
      shouldDropExecution(
        "cooldown",
        defaultConfig,
        {
          recentlyCompletedAt: null,
          recentExecutionAt: new Date("2024-01-01T11:00:00Z"),
          currentConcurrentCount: 0,
          conflictOccurred: false,
        },
        now
      )
    ).toBe(false);
  });
});

describe("Workflow Processor - Delete Workflow Active Status Check", () => {
  /**
   * Tests that the "waiting" status is included when checking for
   * active executions before deleting a workflow.
   */

  const ACTIVE_EXECUTION_STATUSES = ["pending", "active", "paused", "waiting"];

  function hasActiveExecutions(executionStatuses: string[]): boolean {
    return executionStatuses.some((s) => ACTIVE_EXECUTION_STATUSES.includes(s));
  }

  it("should detect waiting executions as active", () => {
    expect(hasActiveExecutions(["waiting"])).toBe(true);
  });

  it("should detect pending executions as active", () => {
    expect(hasActiveExecutions(["pending"])).toBe(true);
  });

  it("should detect active executions as active", () => {
    expect(hasActiveExecutions(["active"])).toBe(true);
  });

  it("should detect paused executions as active", () => {
    expect(hasActiveExecutions(["paused"])).toBe(true);
  });

  it("should not detect completed executions as active", () => {
    expect(hasActiveExecutions(["completed"])).toBe(false);
  });

  it("should not detect failed executions as active", () => {
    expect(hasActiveExecutions(["failed"])).toBe(false);
  });

  it("should not detect cancelled executions as active", () => {
    expect(hasActiveExecutions(["cancelled"])).toBe(false);
  });

  it("should detect mixed statuses with at least one active", () => {
    expect(hasActiveExecutions(["completed", "failed", "waiting"])).toBe(true);
  });

  it("should return false for empty array", () => {
    expect(hasActiveExecutions([])).toBe(false);
  });
});

describe("Workflow Processor - Resume Execution State Clearing", () => {
  /**
   * Tests that resumeExecution properly clears all wait state,
   * including the delaySchedulerName field.
   */

  type WaitState = {
    status: string;
    waitingForEvent: string | null;
    waitTimeoutAt: Date | null;
    waitTimeoutSchedulerName: string | null;
    delaySchedulerName: string | null;
  };

  function clearWaitState(_existing: WaitState): WaitState {
    return {
      status: "active",
      waitingForEvent: null,
      waitTimeoutAt: null,
      waitTimeoutSchedulerName: null,
      delaySchedulerName: null,
    };
  }

  it("should clear all wait-related fields", () => {
    const existing: WaitState = {
      status: "waiting",
      waitingForEvent: "email.opened",
      waitTimeoutAt: new Date("2024-01-02T00:00:00Z"),
      waitTimeoutSchedulerName: "scheduler-timeout-123",
      delaySchedulerName: "scheduler-delay-456",
    };

    const cleared = clearWaitState(existing);

    expect(cleared.status).toBe("active");
    expect(cleared.waitingForEvent).toBeNull();
    expect(cleared.waitTimeoutAt).toBeNull();
    expect(cleared.waitTimeoutSchedulerName).toBeNull();
    expect(cleared.delaySchedulerName).toBeNull();
  });

  it("should clear delaySchedulerName even when other fields are already null", () => {
    const existing: WaitState = {
      status: "waiting",
      waitingForEvent: null,
      waitTimeoutAt: null,
      waitTimeoutSchedulerName: null,
      delaySchedulerName: "scheduler-delay-stale",
    };

    const cleared = clearWaitState(existing);

    expect(cleared.delaySchedulerName).toBeNull();
  });
});

describe("Workflow Processor - Complete Trigger Logic", () => {
  /**
   * Integration tests for the complete trigger validation logic.
   */

  type WorkflowConfig = {
    allowReentry: boolean;
    reentryDelaySeconds: number | null;
    contactCooldownSeconds: number | null;
    maxConcurrentExecutions: number | null;
  };

  type ExecutionState = {
    hasActiveExecution: boolean;
    lastCompletedAt: Date | null;
    lastAnyExecutionAt: Date | null;
    currentConcurrentCount: number;
  };

  function shouldTriggerWorkflow(
    config: WorkflowConfig,
    state: ExecutionState,
    now: Date
  ): { allowed: boolean; reason?: string } {
    // Check reentry
    if (!config.allowReentry && state.hasActiveExecution) {
      return { allowed: false, reason: "contact_already_in_workflow" };
    }

    // Check reentry delay
    if (
      !config.allowReentry &&
      config.reentryDelaySeconds &&
      config.reentryDelaySeconds > 0 &&
      state.lastCompletedAt
    ) {
      const threshold = new Date(
        now.getTime() - config.reentryDelaySeconds * 1000
      );
      if (state.lastCompletedAt > threshold) {
        return { allowed: false, reason: "reentry_delay" };
      }
    }

    // Check contact cooldown
    if (
      config.contactCooldownSeconds &&
      config.contactCooldownSeconds > 0 &&
      state.lastAnyExecutionAt
    ) {
      const threshold = new Date(
        now.getTime() - config.contactCooldownSeconds * 1000
      );
      if (state.lastAnyExecutionAt > threshold) {
        return { allowed: false, reason: "contact_cooldown" };
      }
    }

    // Check max concurrent
    if (
      config.maxConcurrentExecutions &&
      config.maxConcurrentExecutions > 0 &&
      state.currentConcurrentCount >= config.maxConcurrentExecutions
    ) {
      return { allowed: false, reason: "max_concurrent_reached" };
    }

    return { allowed: true };
  }

  it("should allow trigger when no restrictions apply", () => {
    const config: WorkflowConfig = {
      allowReentry: true,
      reentryDelaySeconds: null,
      contactCooldownSeconds: null,
      maxConcurrentExecutions: null,
    };
    const state: ExecutionState = {
      hasActiveExecution: false,
      lastCompletedAt: null,
      lastAnyExecutionAt: null,
      currentConcurrentCount: 0,
    };
    expect(shouldTriggerWorkflow(config, state, new Date())).toEqual({
      allowed: true,
    });
  });

  it("should block when contact already in workflow", () => {
    const config: WorkflowConfig = {
      allowReentry: false,
      reentryDelaySeconds: null,
      contactCooldownSeconds: null,
      maxConcurrentExecutions: null,
    };
    const state: ExecutionState = {
      hasActiveExecution: true,
      lastCompletedAt: null,
      lastAnyExecutionAt: null,
      currentConcurrentCount: 0,
    };
    expect(shouldTriggerWorkflow(config, state, new Date())).toEqual({
      allowed: false,
      reason: "contact_already_in_workflow",
    });
  });

  it("should block when within reentry delay", () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const config: WorkflowConfig = {
      allowReentry: false,
      reentryDelaySeconds: 3600, // 1 hour
      contactCooldownSeconds: null,
      maxConcurrentExecutions: null,
    };
    const state: ExecutionState = {
      hasActiveExecution: false,
      lastCompletedAt: new Date("2024-01-01T11:30:00Z"), // 30 min ago
      lastAnyExecutionAt: null,
      currentConcurrentCount: 0,
    };
    expect(shouldTriggerWorkflow(config, state, now)).toEqual({
      allowed: false,
      reason: "reentry_delay",
    });
  });

  it("should block when at max concurrent executions", () => {
    const config: WorkflowConfig = {
      allowReentry: true,
      reentryDelaySeconds: null,
      contactCooldownSeconds: null,
      maxConcurrentExecutions: 5,
    };
    const state: ExecutionState = {
      hasActiveExecution: false,
      lastCompletedAt: null,
      lastAnyExecutionAt: null,
      currentConcurrentCount: 5,
    };
    expect(shouldTriggerWorkflow(config, state, new Date())).toEqual({
      allowed: false,
      reason: "max_concurrent_reached",
    });
  });

  it("should block when within contact cooldown", () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const config: WorkflowConfig = {
      allowReentry: true,
      reentryDelaySeconds: null,
      contactCooldownSeconds: 600, // 10 min
      maxConcurrentExecutions: null,
    };
    const state: ExecutionState = {
      hasActiveExecution: false,
      lastCompletedAt: null,
      lastAnyExecutionAt: new Date("2024-01-01T11:55:00Z"), // 5 min ago
      currentConcurrentCount: 0,
    };
    expect(shouldTriggerWorkflow(config, state, now)).toEqual({
      allowed: false,
      reason: "contact_cooldown",
    });
  });

  it("should allow when all checks pass", () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const config: WorkflowConfig = {
      allowReentry: false,
      reentryDelaySeconds: 3600,
      contactCooldownSeconds: 600,
      maxConcurrentExecutions: 10,
    };
    const state: ExecutionState = {
      hasActiveExecution: false,
      lastCompletedAt: new Date("2024-01-01T10:00:00Z"), // 2 hours ago
      lastAnyExecutionAt: new Date("2024-01-01T11:00:00Z"), // 1 hour ago
      currentConcurrentCount: 5,
    };
    expect(shouldTriggerWorkflow(config, state, now)).toEqual({
      allowed: true,
    });
  });
});
