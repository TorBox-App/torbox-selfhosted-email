"use client";

import { MailOpen } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "../use-workflow-store";
import { useNodeValidation } from "../use-workflow-store";

type WaitForEmailEngagementNodeProps = {
  id: string;
  data: WorkflowNodeData;
  selected?: boolean;
};

export function WaitForEmailEngagementNode({
  id,
  data,
  selected,
}: WaitForEmailEngagementNodeProps) {
  const config = data.config;
  const { isValid, errorMessage } = useNodeValidation(id);
  let timeoutDisplay = "No timeout";

  if (config.type === "wait_for_email_engagement" && config.timeoutSeconds) {
    const seconds = config.timeoutSeconds;
    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      timeoutDisplay = `${days}d`;
    } else if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      timeoutDisplay = `${hours}h`;
    } else if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      timeoutDisplay = `${minutes}m`;
    } else {
      timeoutDisplay = `${seconds}s`;
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

      {/* Compact card */}
      <div
        className={cn(
          "w-[160px] rounded-lg border-2 bg-white shadow-sm",
          "px-3 py-2",
          "transition-all duration-150",
          selected ? "border-primary ring-2 ring-primary/20" : "border-gray-200",
          !isValid && "border-red-500 ring-2 ring-red-500/20"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-purple-500 flex items-center justify-center text-white shrink-0">
            <MailOpen className="w-3 h-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-xs text-gray-900 truncate">
              {data.name}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              Wait {timeoutDisplay}
            </div>
          </div>
        </div>
      </div>

      {/* Four outputs at bottom */}
      <div className="absolute -bottom-5 left-0 right-0 flex justify-between px-2">
        {/* Opened */}
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-medium text-green-600 mb-0.5">Open</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="opened"
            className="!relative !transform-none !bg-green-500 !w-2 !h-2 !border-2 !border-white"
          />
        </div>

        {/* Clicked */}
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-medium text-blue-600 mb-0.5">Click</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="clicked"
            className="!relative !transform-none !bg-blue-500 !w-2 !h-2 !border-2 !border-white"
          />
        </div>

        {/* Bounced */}
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-medium text-red-600 mb-0.5">Bounce</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="bounced"
            className="!relative !transform-none !bg-red-500 !w-2 !h-2 !border-2 !border-white"
          />
        </div>

        {/* Timeout */}
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-medium text-yellow-600 mb-0.5">None</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            className="!relative !transform-none !bg-yellow-500 !w-2 !h-2 !border-2 !border-white"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-red-500 whitespace-nowrap">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
