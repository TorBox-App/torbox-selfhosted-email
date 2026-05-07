"use client";

import { useQueryClient } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
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

type UpdateContactNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function UpdateContactNode({
  id,
  data,
  selected,
}: UpdateContactNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
  const { showStats, workflowId } = useWorkflowData();
  const queryClient = useQueryClient();
  const allStats = queryClient.getQueryData<
    Record<string, WorkflowNodeStepStats>
  >(workflowNodeStatsKeys.detail(workflowId));
  const stats = getNodeStats(allStats, data.stepId);
  let description = "No updates configured";

  if (config.type === "update_contact" && config.updates?.length > 0) {
    const count = config.updates.length;
    description = `${count} field${count !== 1 ? "s" : ""} to update`;
  }

  return (
    <BaseNode
      accentColor="bg-indigo-500"
      description={description}
      errorMessage={errorMessage}
      hasInput={true}
      hasOutput={true}
      icon={<UserCog className="h-4 w-4" />}
      isValid={isValid}
      label={data.name}
      selected={selected}
    >
      {showStats && stats && <StatsBadge stats={stats} />}
    </BaseNode>
  );
}
