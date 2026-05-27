import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn(),
  deleteScheduledStep: vi.fn().mockResolvedValue(undefined),
  enqueueWorkflowStepBatch: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
  return {
    ...actual,
    db: {
      select: mockDbSelect,
      update: mockDbUpdate,
    },
  };
});

const { cancelExecutionsForTopicUnsubscribe } = await import(
  "../services/workflow-events"
);
const { deleteScheduledStep } = await import("../services/workflow-queue");

function selectChainNoLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function updateChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.set = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  return chain;
}

const BASE_PARAMS = {
  contactId: "contact-1",
  organizationId: "org-1",
  topicId: "topic-1",
};

type MockExecution = {
  id: string;
  workflowId: string;
  delaySchedulerName: string | null;
  waitTimeoutSchedulerName: string | null;
};

function setupMocks(
  opts: { workflows?: Array<{ id: string }>; executions?: MockExecution[] } = {}
) {
  const workflows = opts.workflows ?? [];
  const executions = opts.executions ?? [];

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) return selectChainNoLimit(workflows);
    return selectChainNoLimit(executions);
  });

  const updateCalls: ReturnType<typeof updateChain>[] = [];
  mockDbUpdate.mockImplementation(() => {
    const chain = updateChain();
    updateCalls.push(chain);
    return chain;
  });

  return { updateCalls };
}

describe("cancelExecutionsForTopicUnsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { executionsCancelled: 0 } when no workflows match the topic", async () => {
    setupMocks({ workflows: [] });

    const result = await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(result).toEqual({ executionsCancelled: 0 });
    expect(deleteScheduledStep).not.toHaveBeenCalled();
  });

  it("returns { executionsCancelled: 0 } when workflows found but no active executions", async () => {
    setupMocks({ workflows: [{ id: "wf-1" }], executions: [] });

    const result = await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(result).toEqual({ executionsCancelled: 0 });
    expect(deleteScheduledStep).not.toHaveBeenCalled();
  });

  it("cancels delaySchedulerName when set on an execution", async () => {
    setupMocks({
      workflows: [{ id: "wf-1" }],
      executions: [
        {
          id: "exec-1",
          workflowId: "wf-1",
          delaySchedulerName: "wraps-wf-delay-1",
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-delay-1");
  });

  it("cancels waitTimeoutSchedulerName when set on an execution", async () => {
    setupMocks({
      workflows: [{ id: "wf-1" }],
      executions: [
        {
          id: "exec-1",
          workflowId: "wf-1",
          delaySchedulerName: null,
          waitTimeoutSchedulerName: "wraps-wf-timeout-1",
        },
      ],
    });

    await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-timeout-1");
  });

  it("does NOT call deleteScheduledStep when both scheduler names are null", async () => {
    setupMocks({
      workflows: [{ id: "wf-1" }],
      executions: [
        {
          id: "exec-1",
          workflowId: "wf-1",
          delaySchedulerName: null,
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(deleteScheduledStep).not.toHaveBeenCalled();
  });

  it("updates each execution status to 'cancelled' with timestamps", async () => {
    const { updateCalls } = setupMocks({
      workflows: [{ id: "wf-1" }],
      executions: [
        {
          id: "exec-1",
          workflowId: "wf-1",
          delaySchedulerName: null,
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    const cancelUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.status ===
        "cancelled"
    );
    expect(cancelUpdate).toBeDefined();
    expect(cancelUpdate!.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        completedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    );
  });

  it("decrements workflow.activeExecutions by the number of cancelled executions", async () => {
    const { updateCalls } = setupMocks({
      workflows: [{ id: "wf-1" }],
      executions: [
        {
          id: "exec-1",
          workflowId: "wf-1",
          delaySchedulerName: null,
          waitTimeoutSchedulerName: null,
        },
        {
          id: "exec-2",
          workflowId: "wf-1",
          delaySchedulerName: null,
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    const result = await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(result).toEqual({ executionsCancelled: 2 });
    const decrementUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)
          ?.activeExecutions !== undefined
    );
    expect(decrementUpdate).toBeDefined();
    const activeExArg = (
      decrementUpdate!.set.mock.calls[0]?.[0] as Record<string, unknown>
    ).activeExecutions as { queryChunks?: Array<{ value?: string[] }> };
    const chunkText = activeExArg.queryChunks
      ?.flatMap((c) => c.value ?? [])
      .join(" ");
    expect(chunkText).toContain("- ");
  });

  it("handles multiple executions across multiple workflows", async () => {
    const { updateCalls } = setupMocks({
      workflows: [{ id: "wf-1" }, { id: "wf-2" }],
      executions: [
        {
          id: "exec-1",
          workflowId: "wf-1",
          delaySchedulerName: "wraps-wf-delay-1",
          waitTimeoutSchedulerName: null,
        },
        {
          id: "exec-2",
          workflowId: "wf-2",
          delaySchedulerName: null,
          waitTimeoutSchedulerName: "wraps-wf-timeout-2",
        },
      ],
    });

    const result = await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(result).toEqual({ executionsCancelled: 2 });
    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-delay-1");
    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-timeout-2");
    expect(deleteScheduledStep).toHaveBeenCalledTimes(2);
    // 1 batch execution update + 1 decrement per workflow
    expect(updateCalls).toHaveLength(3);
  });

  it("cancels both scheduler names when both are set on a single execution", async () => {
    setupMocks({
      workflows: [{ id: "wf-1" }],
      executions: [
        {
          id: "exec-1",
          workflowId: "wf-1",
          delaySchedulerName: "wraps-wf-delay-1",
          waitTimeoutSchedulerName: "wraps-wf-timeout-1",
        },
      ],
    });

    await cancelExecutionsForTopicUnsubscribe(BASE_PARAMS);

    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-delay-1");
    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-timeout-1");
    expect(deleteScheduledStep).toHaveBeenCalledTimes(2);
  });
});
