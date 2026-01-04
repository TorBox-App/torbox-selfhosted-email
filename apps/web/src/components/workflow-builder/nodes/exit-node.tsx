"use client";

import { LogOut } from "lucide-react";
import { BaseNode } from "./base-node";
import type { WorkflowNodeData } from "../use-workflow-store";

type ExitNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function ExitNode({ data, selected }: ExitNodeProps) {
  return (
    <BaseNode
      icon={<LogOut className="w-4 h-4" />}
      label={data.name}
      description="End workflow"
      accentColor="bg-red-500"
      hasInput={true}
      hasOutput={false}
      isValid={data.isValid}
      errorMessage={data.errorMessage}
      selected={selected}
    />
  );
}
