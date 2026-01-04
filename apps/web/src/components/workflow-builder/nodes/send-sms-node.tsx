"use client";

import { MessageSquare } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";

type SendSmsNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function SendSmsNode({ id, data, selected }: SendSmsNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
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
      isValid={isValid}
      errorMessage={errorMessage}
      selected={selected}
    />
  );
}
