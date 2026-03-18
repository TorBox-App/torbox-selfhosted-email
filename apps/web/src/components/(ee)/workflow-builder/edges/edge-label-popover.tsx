"use client";

import { useOnViewportChange } from "@xyflow/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getConditionSummary } from "../lib/condition-summary";
import { useWorkflowStore } from "../use-workflow-store";

type EdgeLabelPopoverProps = {
  sourceNodeId: string;
  sourceHandleId: string;
  label: string;
  labelColor: string;
};

export function EdgeLabelPopover({
  sourceNodeId,
  sourceHandleId,
  label,
  labelColor,
}: EdgeLabelPopoverProps) {
  const [open, setOpen] = useState(false);
  const sourceNode = useWorkflowStore((state) =>
    state.nodes.find((n) => n.id === sourceNodeId)
  );
  const selectNode = useWorkflowStore((state) => state.selectNode);

  useOnViewportChange({
    onStart: () => setOpen(false),
  });

  const summary = sourceNode
    ? getConditionSummary(sourceNode.data.config, sourceHandleId)
    : null;

  // No popover content available -- render plain badge
  if (!summary) {
    return (
      <div className={`rounded px-2 py-0.5 font-medium text-xs ${labelColor}`}>
        {label}
      </div>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className={`cursor-pointer rounded px-2 py-0.5 font-medium text-xs ${labelColor}`}
          type="button"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        onPointerDownOutside={(e) => e.preventDefault()}
        side="top"
        sideOffset={8}
      >
        <div className="space-y-2">
          <p className="font-medium text-sm">{summary.title}</p>
          <p className="text-muted-foreground text-xs">{summary.description}</p>
          <Button
            className="w-full"
            onClick={() => {
              selectNode(sourceNodeId);
              setOpen(false);
            }}
            size="sm"
            variant="outline"
          >
            Configure
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
