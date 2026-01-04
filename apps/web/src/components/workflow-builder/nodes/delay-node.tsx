"use client";

import { Clock } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";

type DelayNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function DelayNode({ id, data, selected }: DelayNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
  let description = "Configure delay";

  if (config.type === "delay") {
    const amount = config.amount || 1;
    const unit = config.unit || "days";
    const plural = amount !== 1 ? "s" : "";
    description = `Wait ${amount} ${unit}${unit.endsWith("s") ? "" : plural}`;
  }

  return (
    <BaseNode
      icon={<Clock className="w-4 h-4" />}
      label={data.name}
      description={description}
      accentColor="bg-purple-500"
      hasInput={true}
      hasOutput={true}
      isValid={isValid}
      errorMessage={errorMessage}
      selected={selected}
    />
  );
}
