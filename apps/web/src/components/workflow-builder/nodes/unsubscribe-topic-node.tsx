"use client";

import { BellOff } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type UnsubscribeTopicNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function UnsubscribeTopicNode({ data, selected }: UnsubscribeTopicNodeProps) {
  const config = data.config;
  let description = "Select topic";

  if (config.type === "unsubscribe_topic") {
    if (config.topicId) {
      // We'd ideally show the topic name, but for now show channel
      const channel = config.channel === "sms" ? "SMS" : "Email";
      description = `Unsubscribe from ${channel}`;
    }
  }

  return (
    <BaseNode
      icon={<BellOff className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-rose-500"
      hasInput={true}
      hasOutput={true}
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
