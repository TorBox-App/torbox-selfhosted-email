"use client";

import { BellPlus } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type SubscribeTopicNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function SubscribeTopicNode({ data, selected }: SubscribeTopicNodeProps) {
  const config = data.config;
  let description = "Select topic";

  if (config.type === "subscribe_topic") {
    if (config.topicId) {
      // We'd ideally show the topic name, but for now show channel
      const channel = config.channel === "sms" ? "SMS" : "Email";
      description = `Subscribe to ${channel}`;
    }
  }

  return (
    <BaseNode
      icon={<BellPlus className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-emerald-500"
      hasInput={true}
      hasOutput={true}
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
