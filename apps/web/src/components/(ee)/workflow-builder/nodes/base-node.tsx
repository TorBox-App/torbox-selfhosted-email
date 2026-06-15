"use client";

import { Handle, Position, useNodeId } from "@xyflow/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "../use-workflow-store";

type BaseNodeProps = {
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
  children?: React.ReactNode;
};

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
  children,
}: BaseNodeProps) {
  const nodeId = useNodeId();
  const updateNodeName = useWorkflowStore((s) => s.updateNodeName);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const commit = () => {
    const trimmed = draft.trim();
    if (nodeId && trimmed && trimmed !== label) {
      updateNodeName(nodeId, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-background px-4 py-3 shadow-sm",
        "transition-all duration-150",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
        !isValid && "border-destructive ring-2 ring-destructive/20"
      )}
    >
      {hasInput && (
        <Handle
          className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
          position={Position.Top}
          type="target"
        />
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-white",
            accentColor
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              aria-label="Node name"
              autoFocus
              className="nodrag w-full rounded border bg-background px-1 font-medium text-foreground text-sm outline-none"
              onBlur={commit}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commit();
                } else if (e.key === "Escape") {
                  setDraft(label);
                  setIsEditing(false);
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              value={draft}
            />
          ) : (
            <div
              className="truncate font-medium text-foreground text-sm"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setDraft(label);
                setIsEditing(true);
              }}
              title="Double-click to rename"
            >
              {label}
            </div>
          )}
          {description && (
            <div className="truncate text-muted-foreground text-xs">
              {description}
            </div>
          )}
        </div>
      </div>

      {!isValid && errorMessage && (
        <div className="mt-2 text-destructive text-xs">{errorMessage}</div>
      )}

      {children}

      {hasOutput && !outputs && (
        <Handle
          className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
          position={Position.Bottom}
          type="source"
        />
      )}

      {outputs?.map((output, index) => (
        <Handle
          className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
          id={output.id}
          key={output.id}
          position={Position.Bottom}
          style={{
            left: `${((index + 1) / (outputs.length + 1)) * 100}%`,
          }}
          type="source"
        />
      ))}
    </div>
  );
}
