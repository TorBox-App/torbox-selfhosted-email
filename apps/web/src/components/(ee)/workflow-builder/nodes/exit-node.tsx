"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { WorkflowNodeStepStats } from "@/actions/workflows";
import {
  getNodeStats,
  workflowNodeStatsKeys,
} from "../hooks/use-workflow-node-stats";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";
import { useWorkflowData } from "../workflow-data-context";
import { BaseNode } from "./base-node";
import { StatsBadge } from "./stats-badge";

type ExitNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function ExitNode({ id, data, selected }: ExitNodeProps) {
  const { isValid, errorMessage } = useNodeValidation(id);
  const { showStats, workflowId } = useWorkflowData();
  const queryClient = useQueryClient();
  const allStats = queryClient.getQueryData<
    Record<string, WorkflowNodeStepStats>
  >(workflowNodeStatsKeys.detail(workflowId));
  const stats = getNodeStats(allStats, data.stepId);

  return (
    <BaseNode
      accentColor="bg-red-500"
      description="End workflow"
      errorMessage={errorMessage}
      hasInput={true}
      hasOutput={false}
      icon={<LogOut className="h-4 w-4" />}
      isValid={isValid}
      label={data.name}
      selected={selected}
    >
      {showStats && stats && <StatsBadge stats={stats} />}
    </BaseNode>
  );
}
