"use client";

import { Handle, Position } from "@xyflow/react";
import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";

type WaitForEventNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function WaitForEventNode({
  id,
  data,
  selected,
}: WaitForEventNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
  let eventDisplay = "Configure event";
  let timeoutDisplay = "No timeout";

  if (config.type === "wait_for_event") {
    if (config.eventName) {
      eventDisplay = config.eventName;
    }
    if (config.timeoutSeconds) {
      const seconds = config.timeoutSeconds;
      if (seconds >= 86_400) {
        const days = Math.floor(seconds / 86_400);
        timeoutDisplay = `${days} day${days !== 1 ? "s" : ""}`;
      } else if (seconds >= 3600) {
        const hours = Math.floor(seconds / 3600);
        timeoutDisplay = `${hours} hour${hours !== 1 ? "s" : ""}`;
      } else if (seconds >= 60) {
        const minutes = Math.floor(seconds / 60);
        timeoutDisplay = `${minutes} min${minutes !== 1 ? "s" : ""}`;
      } else {
        timeoutDisplay = `${seconds} sec${seconds !== 1 ? "s" : ""}`;
      }
    }
  }

  return (
    <div className="relative">
      {/* Input handle at top */}
      <Handle
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
        position={Position.Top}
        type="target"
      />

      {/* Compact card */}
      <div
        className={cn(
          "w-[160px] rounded-lg border-2 bg-white shadow-sm",
          "px-3 py-2",
          "transition-all duration-150",
          selected
            ? "border-primary ring-2 ring-primary/20"
            : "border-gray-200",
          !isValid && "border-red-500 ring-2 ring-red-500/20"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-500 text-white">
            <Hourglass className="h-3 w-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-gray-900 text-xs">
              {data.name}
            </div>
            <div className="truncate text-[10px] text-gray-500">
              {eventDisplay} • {timeoutDisplay}
            </div>
          </div>
        </div>
      </div>

      {/* Three outputs at bottom */}
      <div className="absolute right-0 -bottom-5 left-0 flex justify-between px-3">
        {/* Event received - left */}
        <div className="flex flex-col items-center">
          <span className="mb-0.5 font-medium text-[8px] text-green-600">
            Event
          </span>
          <Handle
            className="!relative !transform-none !bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white"
            id="yes"
            position={Position.Bottom}
            type="source"
          />
        </div>

        {/* No match - center */}
        <div className="flex flex-col items-center">
          <span className="mb-0.5 font-medium text-[8px] text-gray-600">
            No Match
          </span>
          <Handle
            className="!relative !transform-none !bg-gray-400 !w-2.5 !h-2.5 !border-2 !border-white"
            id="no"
            position={Position.Bottom}
            type="source"
          />
        </div>

        {/* Timeout - right */}
        <div className="flex flex-col items-center">
          <span className="mb-0.5 font-medium text-[8px] text-yellow-600">
            Timeout
          </span>
          <Handle
            className="!relative !transform-none !bg-yellow-500 !w-2.5 !h-2.5 !border-2 !border-white"
            id="timeout"
            position={Position.Bottom}
            type="source"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-red-500 text-xs">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
