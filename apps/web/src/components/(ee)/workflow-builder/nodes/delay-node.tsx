"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import type { WorkflowNodeStepStats } from "@/actions/(ee)/workflows";
import {
  getNodeStats,
  workflowNodeStatsKeys,
} from "../hooks/use-workflow-node-stats";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";
import { useWorkflowData } from "../workflow-data-context";
import { BaseNode } from "./base-node";
import { StatsBadge } from "./stats-badge";

type DelayNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function DelayNode({ id, data, selected }: DelayNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
  const { showStats, workflowId } = useWorkflowData();
  const queryClient = useQueryClient();
  const allStats = queryClient.getQueryData<
    Record<string, WorkflowNodeStepStats>
  >(workflowNodeStatsKeys.detail(workflowId));
  const stats = getNodeStats(allStats, data.stepId);
  let description = "Configure delay";

  if (config.type === "delay") {
    const amount = config.amount || 1;
    const unit = config.unit || "days";
    const plural = amount !== 1 ? "s" : "";
    description = `Wait ${amount} ${unit}${unit.endsWith("s") ? "" : plural}`;
  }

  return (
    <BaseNode
      accentColor="bg-purple-500"
      description={description}
      errorMessage={errorMessage}
      hasInput={true}
      hasOutput={true}
      icon={<Clock className="h-4 w-4" />}
      isValid={isValid}
      label={data.name}
      selected={selected}
    >
      {showStats && stats && <StatsBadge stats={stats} />}
    </BaseNode>
  );
}
