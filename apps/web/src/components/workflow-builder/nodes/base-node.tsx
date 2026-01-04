"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

interface BaseNodeProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  accentColor: string;
  hasInput?: boolean;
  hasOutput?: boolean;
  outputs?: { id: string; label: string }[];
  isValid?: boolean;
  errorMessage?: string;
  selected?: boolean;
}

export function BaseNode({
  icon,
  label,
  description,
  accentColor,
  hasInput = true,
  hasOutput = true,
  outputs,
  isValid = true,
  errorMessage,
  selected,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-white shadow-sm min-w-[180px]",
        "transition-all duration-150",
        selected ? "border-primary ring-2 ring-primary/20" : "border-gray-200",
        !isValid && "border-red-500 ring-2 ring-red-500/20"
      )}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
        />
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center text-white",
            accentColor
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">
            {label}
          </div>
          {description && (
            <div className="text-xs text-gray-500 truncate">{description}</div>
          )}
        </div>
      </div>

      {!isValid && errorMessage && (
        <div className="mt-2 text-xs text-red-500">{errorMessage}</div>
      )}

      {hasOutput && !outputs && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
        />
      )}

      {outputs?.map((output, index) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Bottom}
          id={output.id}
          className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
          style={{
            left: `${((index + 1) / (outputs.length + 1)) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
