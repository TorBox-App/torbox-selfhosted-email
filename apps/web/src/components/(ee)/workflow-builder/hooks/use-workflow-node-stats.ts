"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getWorkflowNodeStats,
  type WorkflowNodeStepStats,
} from "@/actions/(ee)/workflows";

export const workflowNodeStatsKeys = {
  all: ["workflow-node-stats"] as const,
  detail: (workflowId: string) =>
    [...workflowNodeStatsKeys.all, workflowId] as const,
};

export function useWorkflowNodeStats(
  workflowId: string | undefined,
  organizationId: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: workflowNodeStatsKeys.detail(workflowId ?? ""),
    queryFn: async () => {
      if (!workflowId) {
        return {};
      }
      const result = await getWorkflowNodeStats(workflowId, organizationId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.stats;
    },
    enabled: enabled && !!workflowId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Pure function to aggregate stats across cascade primitive IDs.
 * Exported for testability.
 */
export function aggregateCascadeStats(
  allStats: Record<string, WorkflowNodeStepStats>,
  stepId: string,
  cascadePrimitiveIds: string[]
): WorkflowNodeStepStats | null {
  const aggregated: WorkflowNodeStepStats = {
    stepId,
    stepType: "cascade",
    totalCount: 0,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    bouncedCount: 0,
  };

  let hasAny = false;
  for (const primitiveId of cascadePrimitiveIds) {
    const s = allStats[primitiveId];
    if (!s) {
      continue;
    }
    hasAny = true;
    aggregated.totalCount += s.totalCount;
    aggregated.completedCount += s.completedCount;
    aggregated.failedCount += s.failedCount;
    aggregated.skippedCount += s.skippedCount;
    aggregated.sentCount = (aggregated.sentCount ?? 0) + (s.sentCount ?? 0);
    aggregated.deliveredCount =
      (aggregated.deliveredCount ?? 0) + (s.deliveredCount ?? 0);
    aggregated.openedCount =
      (aggregated.openedCount ?? 0) + (s.openedCount ?? 0);
    aggregated.clickedCount =
      (aggregated.clickedCount ?? 0) + (s.clickedCount ?? 0);
    aggregated.bouncedCount =
      (aggregated.bouncedCount ?? 0) + (s.bouncedCount ?? 0);
  }

  return hasAny ? aggregated : null;
}

/**
 * Select stats for a single node from cached query data.
 * For cascade nodes, aggregates stats from all primitive step IDs.
 */
export function getNodeStats(
  stats: Record<string, WorkflowNodeStepStats> | undefined,
  stepId: string,
  cascadePrimitiveIds?: string[]
): WorkflowNodeStepStats | null {
  if (!stats) {
    return null;
  }

  if (!cascadePrimitiveIds || cascadePrimitiveIds.length === 0) {
    return stats[stepId] ?? null;
  }

  return aggregateCascadeStats(stats, stepId, cascadePrimitiveIds);
}
