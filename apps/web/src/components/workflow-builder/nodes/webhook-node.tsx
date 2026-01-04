"use client";

import { Webhook } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";

type WebhookNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function WebhookNode({ id, data, selected }: WebhookNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
  let description = "No URL configured";

  if (config.type === "webhook" && config.url) {
    try {
      const url = new URL(config.url);
      description = `${config.method || "POST"} ${url.hostname}`;
    } catch {
      description = `${config.method || "POST"} ${config.url.substring(0, 20)}...`;
    }
  }

  return (
    <BaseNode
      icon={<Webhook className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-cyan-500"
      hasInput={true}
      hasOutput={true}
      isValid={isValid}
      errorMessage={errorMessage}
      selected={selected}
    />
  );
}
