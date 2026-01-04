"use client";

import { Hourglass } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../use-workflow-store";

type WaitForEventNodeProps = {
  data: WorkflowNodeData;
  selected?: boolean;
};

export function WaitForEventNode({ data, selected }: WaitForEventNodeProps) {
  const config = data.config;
  let eventDisplay = "Configure event";
  let timeoutDisplay = "No timeout";

  if (config.type === "wait_for_event") {
    if (config.eventName) {
      eventDisplay = config.eventName;
    }
    if (config.timeoutSeconds) {
      const seconds = config.timeoutSeconds;
      if (seconds >= 86400) {
        const days = Math.floor(seconds / 86400);
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
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
      />

      {/* Hexagon-ish shape with rounded corners */}
      <div
        className={cn(
          "w-[180px] min-h-[100px] rounded-xl border-2 bg-white shadow-sm",
          "flex flex-col items-center justify-center p-3",
          "transition-all duration-150",
          selected ? "border-primary ring-2 ring-primary/20" : "border-gray-200",
          !data.isValid && "border-red-500 ring-2 ring-red-500/20"
        )}
      >
        <div className="w-8 h-8 rounded-md bg-amber-500 flex items-center justify-center text-white mb-2">
          <Hourglass className="w-4 h-4" />
        </div>
        <div className="font-medium text-sm text-gray-900 text-center truncate max-w-full">
          {data.name}
        </div>
        <div className="text-xs text-gray-500 text-center mt-1">
          Wait for: <span className="font-medium">{eventDisplay}</span>
        </div>
        <div className="text-xs text-gray-400 text-center">
          Timeout: {timeoutDisplay}
        </div>
      </div>

      {/* Three outputs at bottom */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-4">
        {/* Event received - left */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-medium text-green-600 mb-1">Event</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!relative !transform-none !bg-green-500 !w-3 !h-3 !border-2 !border-white"
          />
        </div>

        {/* No match - center */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-medium text-gray-600 mb-1">No Match</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!relative !transform-none !bg-gray-400 !w-3 !h-3 !border-2 !border-white"
          />
        </div>

        {/* Timeout - right */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-medium text-yellow-600 mb-1">Timeout</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            className="!relative !transform-none !bg-yellow-500 !w-3 !h-3 !border-2 !border-white"
          />
        </div>
      </div>

      {data.errorMessage && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-xs text-red-500 whitespace-nowrap">
          {data.errorMessage}
        </div>
      )}
    </div>
  );
}
