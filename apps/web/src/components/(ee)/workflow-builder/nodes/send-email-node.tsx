"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
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

type SendEmailNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function SendEmailNode({ id, data, selected }: SendEmailNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
  const { showStats, workflowId } = useWorkflowData();
  const queryClient = useQueryClient();
  const allStats = queryClient.getQueryData<
    Record<string, WorkflowNodeStepStats>
  >(workflowNodeStatsKeys.detail(workflowId));
  const stats = getNodeStats(allStats, data.stepId);
  let description = "No template selected";

  if (config.type === "send_email" && config.templateId) {
    description = "Template selected";
  }

  return (
    <BaseNode
      accentColor="bg-blue-500"
      description={description}
      errorMessage={errorMessage}
      hasInput={true}
      hasOutput={true}
      icon={<Mail className="h-4 w-4" />}
      isValid={isValid}
      label={data.name}
      selected={selected}
    >
      {showStats && stats && <StatsBadge stats={stats} />}
    </BaseNode>
  );
}
