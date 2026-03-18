import { describe, expect, it } from "vitest";
import type { WorkflowNodeStepStats } from "@/actions/workflows";
import {
  aggregateCascadeStats,
  getNodeStats,
} from "../use-workflow-node-stats";

function makeStats(
  overrides: Partial<WorkflowNodeStepStats> = {}
): WorkflowNodeStepStats {
  return {
    stepId: "step-1",
    stepType: "send_email",
    totalCount: 0,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    ...overrides,
  };
}

describe("getNodeStats", () => {
  it("returns null when stats are undefined", () => {
    expect(getNodeStats(undefined, "step-1")).toBeNull();
  });

  it("returns direct stats for non-cascade node", () => {
    const stats: Record<string, WorkflowNodeStepStats> = {
      "step-1": makeStats({ stepId: "step-1", totalCount: 5 }),
    };
    const result = getNodeStats(stats, "step-1");
    expect(result).not.toBeNull();
    expect(result!.totalCount).toBe(5);
  });

  it("returns null when stepId not found", () => {
    const stats: Record<string, WorkflowNodeStepStats> = {
      "step-1": makeStats({ stepId: "step-1" }),
    };
    expect(getNodeStats(stats, "step-2")).toBeNull();
  });
});

describe("aggregateCascadeStats", () => {
  it("aggregates stats across cascade primitive IDs", () => {
    const stats: Record<string, WorkflowNodeStepStats> = {
      "group-send-0": makeStats({
        stepId: "group-send-0",
        totalCount: 10,
        completedCount: 8,
        sentCount: 8,
        openedCount: 3,
      }),
      "group-cond-0": makeStats({
        stepId: "group-cond-0",
        stepType: "condition",
        totalCount: 10,
        completedCount: 10,
        yesBranchCount: 6,
        noBranchCount: 4,
      }),
    };

    const result = aggregateCascadeStats(stats, "group", [
      "group-send-0",
      "group-cond-0",
    ]);

    expect(result).not.toBeNull();
    expect(result!.totalCount).toBe(20);
    expect(result!.completedCount).toBe(18);
    expect(result!.sentCount).toBe(8);
    expect(result!.openedCount).toBe(3);
    expect(result!.stepType).toBe("cascade");
  });

  it("returns null when no primitives match", () => {
    const stats: Record<string, WorkflowNodeStepStats> = {};
    const result = aggregateCascadeStats(stats, "group", [
      "group-send-0",
      "group-cond-0",
    ]);
    expect(result).toBeNull();
  });
});
