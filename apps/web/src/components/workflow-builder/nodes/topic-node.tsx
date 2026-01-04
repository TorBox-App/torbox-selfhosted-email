"use client";

import { Bell } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";
import { useWorkflowData } from "../workflow-data-context";

type TopicNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function TopicNode({ id, data, selected }: TopicNodeProps) {
  const config = data.config;
  const { topics } = useWorkflowData();
  const { isValid, errorMessage } = useNodeValidation(id);
  let description = "Configure topic";
  let action = "Subscribe";

  if (config.type === "subscribe_topic") {
    action = "Subscribe";
    const topicName = topics.find((t) => t.id === config.topicId)?.name;
    description = topicName ? `Subscribe: ${topicName}` : "Select topic";
  } else if (config.type === "unsubscribe_topic") {
    action = "Unsubscribe";
    const topicName = topics.find((t) => t.id === config.topicId)?.name;
    description = topicName ? `Unsubscribe: ${topicName}` : "Select topic";
  }

  return (
    <BaseNode
      icon={<Bell className="w-4 h-4" />}
      label={data.name || action}
      description={description}
      accentColor="bg-emerald-500"
      hasInput={true}
      hasOutput={true}
      isValid={isValid}
      errorMessage={errorMessage}
      selected={selected}
    />
  );
}
