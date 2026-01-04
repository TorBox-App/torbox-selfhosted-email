"use client";

import { Zap } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type TriggerNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function TriggerNode({ data, selected }: TriggerNodeProps) {
  const config = data.config;
  let description = "When triggered";

  if (config.type === "trigger") {
    switch (config.triggerType) {
      case "contact_created":
        description = "When a contact is created";
        break;
      case "contact_updated":
        description = "When a contact is updated";
        break;
      case "event":
        description = config.eventName
          ? `Event: ${config.eventName}`
          : "Custom event (not configured)";
        break;
      case "segment_entry":
        description = config.segmentId
          ? `Segment entry: ${config.segmentId}`
          : "Segment entry";
        break;
      case "segment_exit":
        description = config.segmentId
          ? `Segment exit: ${config.segmentId}`
          : "Segment exit";
        break;
      case "schedule":
        description = config.schedule
          ? `Schedule: ${config.schedule}`
          : "Scheduled";
        break;
      case "api":
        description = "API trigger";
        break;
    }
  }

  return (
    <BaseNode
      icon={<Zap className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-yellow-500"
      hasInput={false}
      hasOutput={true}
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
