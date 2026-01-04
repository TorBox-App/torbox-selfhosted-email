"use client";

import { MessageSquare } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type SendSmsNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function SendSmsNode({ data, selected }: SendSmsNodeProps) {
  const config = data.config;
  let description = "No message configured";

  if (config.type === "send_sms" && config.body) {
    description =
      config.body.length > 30
        ? `${config.body.substring(0, 30)}...`
        : config.body;
  }

  return (
    <BaseNode
      icon={<MessageSquare className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-green-500"
      hasInput={true}
      hasOutput={true}
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
