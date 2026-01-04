"use client";

import { Webhook } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type WebhookNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function WebhookNode({ data, selected }: WebhookNodeProps) {
  const config = data.config;
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
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
