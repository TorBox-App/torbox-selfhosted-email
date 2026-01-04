"use client";

import { GitBranch } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../use-workflow-store";

type ConditionNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function ConditionNode({ data, selected }: ConditionNodeProps) {
  const config = data.config;
  let description = "Configure condition";

  if (config.type === "condition" && config.field) {
    const operatorLabels: Record<string, string> = {
      equals: "=",
      not_equals: "≠",
      contains: "contains",
      not_contains: "not contains",
      starts_with: "starts with",
      ends_with: "ends with",
      greater_than: ">",
      less_than: "<",
      is_set: "is set",
      is_not_set: "is not set",
    };
    const op = operatorLabels[config.operator] || config.operator;

    if (config.operator === "is_set" || config.operator === "is_not_set") {
      description = `${config.field} ${op}`;
    } else {
      description = `${config.field} ${op} ${config.value}`;
    }
  }

  return (
    <div className="relative">
      {/* Input handle at top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
      />

      {/* Diamond shape container */}
      <div
        className={cn(
          "w-[90px] h-[90px] rotate-45 rounded-md border-2 bg-white shadow-sm",
          "flex items-center justify-center",
          "transition-all duration-150",
          selected ? "border-primary ring-2 ring-primary/20" : "border-gray-200",
          !data.isValid && "border-red-500 ring-2 ring-red-500/20"
        )}
      >
        {/* Content rotated back */}
        <div className="-rotate-45 flex flex-col items-center text-center px-1">
          <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center text-white mb-0.5">
            <GitBranch className="w-3 h-3" />
          </div>
          <div className="font-medium text-[10px] text-gray-900 truncate max-w-[55px]">
            {data.name}
          </div>
          <div className="text-[8px] text-gray-500 truncate max-w-[55px]">
            {description}
          </div>
        </div>
      </div>

      {/* Yes output - bottom left */}
      <div className="absolute -bottom-5 left-2 flex flex-col items-center">
        <span className="text-[8px] font-medium text-green-600 mb-0.5">Yes</span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="yes"
          className="!relative !transform-none !bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white"
        />
      </div>

      {/* No output - bottom right */}
      <div className="absolute -bottom-5 right-2 flex flex-col items-center">
        <span className="text-[8px] font-medium text-red-600 mb-0.5">No</span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="no"
          className="!relative !transform-none !bg-red-500 !w-2.5 !h-2.5 !border-2 !border-white"
        />
      </div>

      {data.errorMessage && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-xs text-red-500 whitespace-nowrap">
          {data.errorMessage}
        </div>
      )}
    </div>
  );
}
