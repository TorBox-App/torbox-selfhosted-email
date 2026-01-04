"use client";

import { Mail } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type SendEmailNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function SendEmailNode({ data, selected }: SendEmailNodeProps) {
  const config = data.config;
  let description = "No template selected";

  if (config.type === "send_email" && config.templateId) {
    description = "Template selected";
  }

  return (
    <BaseNode
      icon={<Mail className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-blue-500"
      hasInput={true}
      hasOutput={true}
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
