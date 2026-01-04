"use client";

import { LogOut } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";

type ExitNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function ExitNode({ id, data, selected }: ExitNodeProps) {
  const { isValid, errorMessage } = useNodeValidation(id);

  return (
    <BaseNode
      icon={<LogOut className="w-4 h-4" />}
      label={data.name}
      description="End workflow"
      accentColor="bg-red-500"
      hasInput={true}
      hasOutput={false}
      isValid={isValid}
      errorMessage={errorMessage}
      selected={selected}
    />
  );
}
