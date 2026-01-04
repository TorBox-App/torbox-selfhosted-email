"use client";

import type { Workflow } from "@wraps/db";
import { AlertCircle, ArrowLeft, Loader2, Pause, Pencil, Play, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { disableWorkflow, enableWorkflow, updateWorkflow } from "@/actions/workflows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsDirty, useIsSaving, useValidationResult, useWorkflowStore } from "./use-workflow-store";

interface WorkflowToolbarProps {
  workflow: Workflow;
  orgSlug: string;
  organizationId: string;
}

export function WorkflowToolbar({
  workflow,
  orgSlug,
  organizationId,
}: WorkflowToolbarProps) {
  const [isPending, startTransition] = useTransition();
  const [isEnabling, startEnableTransition] = useTransition();
  const isDirty = useIsDirty();
  const isSaving = useIsSaving();
  const validationResult = useValidationResult();
  const getWorkflowDefinition = useWorkflowStore(
    (state) => state.getWorkflowDefinition
  );
  const setIsSaving = useWorkflowStore((state) => state.setIsSaving);
  const updateWorkflowAfterSave = useWorkflowStore((state) => state.updateWorkflowAfterSave);
  const runValidation = useWorkflowStore((state) => state.runValidation);
  const workflowState = useWorkflowStore((state) => state.workflow);
  const updateWorkflowSettings = useWorkflowStore((state) => state.updateWorkflowSettings);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);

  // Editable name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Run validation on mount and when nodes/edges change
  useEffect(() => {
    runValidation();
  }, [nodes, edges, runValidation]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleStartEditingName = () => {
    setEditedName(workflowState?.name || workflow.name);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== (workflowState?.name || workflow.name)) {
      updateWorkflowSettings({ name: trimmedName });
    }
    setIsEditingName(false);
  };

  const handleKeyDownName = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
    }
  };

  const currentStatus = workflowState?.status ?? workflow.status;
  const isEnabled = currentStatus === "enabled";
  const errorCount = validationResult?.errors.filter((e) => e.severity === "error").length ?? 0;
  const hasErrors = errorCount > 0;

  const handleSave = () => {
    startTransition(async () => {
      setIsSaving(true);
      try {
        const definition = getWorkflowDefinition();

        // Extract trigger config from the trigger step (source of truth)
        const triggerStep = definition.steps.find((s) => s.type === "trigger");
        const triggerConfig = triggerStep?.config;

        const result = await updateWorkflow(workflow.id, organizationId, {
          name: workflowState?.name ?? undefined,
          description: workflowState?.description ?? undefined,
          // Sync trigger settings from the trigger step
          triggerType: triggerConfig?.type === "trigger" ? triggerConfig.triggerType : undefined,
          triggerConfig: triggerConfig?.type === "trigger"
            ? { eventName: triggerConfig.eventName, segmentId: triggerConfig.segmentId, schedule: triggerConfig.schedule, timezone: triggerConfig.timezone }
            : undefined,
          steps: definition.steps,
          transitions: definition.transitions,
          canvasViewport: definition.canvasViewport,
        });

        if (result.success) {
          // Update workflow metadata without touching nodes/edges
          // This prevents React Flow from firing change events that would re-dirty the state
          updateWorkflowAfterSave(result.workflow);
          toast.success("Workflow saved");
        } else {
          toast.error(result.error);
        }
      } finally {
        setIsSaving(false);
      }
    });
  };

  const handleEnable = () => {
    // Run validation first
    const result = runValidation();
    if (!result.isValid) {
      toast.error(`Cannot enable: ${errorCount} issue${errorCount > 1 ? "s" : ""} to fix`);
      return;
    }

    // Must save before enabling
    if (isDirty) {
      toast.error("Please save your changes before enabling the workflow");
      return;
    }

    startEnableTransition(async () => {
      const result = await enableWorkflow(workflow.id, organizationId);
      if (result.success) {
        updateWorkflowAfterSave(result.workflow);
        toast.success("Workflow enabled");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDisable = () => {
    startEnableTransition(async () => {
      const result = await disableWorkflow(workflow.id, organizationId);
      if (result.success) {
        updateWorkflowAfterSave(result.workflow);
        toast.success("Workflow paused");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="h-14 border-b bg-white flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Link href={`/${orgSlug}/automations`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleKeyDownName}
                className="font-semibold bg-transparent border-b border-primary outline-none min-w-[200px]"
              />
            ) : (
              <button
                onClick={handleStartEditingName}
                className="flex items-center gap-1.5 font-semibold hover:text-primary transition-colors group"
              >
                {workflowState?.name || workflow.name}
                <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
              </button>
            )}
            <Badge
              variant={(workflowState?.status ?? workflow.status) === "enabled" ? "default" : "secondary"}
            >
              {workflowState?.status ?? workflow.status}
            </Badge>
            {isDirty && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                Unsaved
              </Badge>
            )}
          </div>
          {(workflowState?.description || workflow.description) && (
            <p className="text-sm text-gray-500">
              {workflowState?.description || workflow.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Validation error indicator */}
        {hasErrors && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorCount} issue{errorCount > 1 ? "s" : ""}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <ul className="text-xs space-y-1">
                  {validationResult?.errors
                    .filter((e) => e.severity === "error")
                    .slice(0, 5)
                    .map((error, i) => (
                      <li key={i}>• {error.message}</li>
                    ))}
                  {errorCount > 5 && (
                    <li className="text-muted-foreground">
                      ...and {errorCount - 5} more
                    </li>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Save button */}
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!isDirty || isPending || isSaving}
        >
          {isPending || isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save
            </>
          )}
        </Button>

        {/* Enable/Disable button */}
        {isEnabled ? (
          <Button
            variant="outline"
            onClick={handleDisable}
            disabled={isEnabling}
          >
            {isEnabling ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Pause className="w-4 h-4 mr-2" />
            )}
            Pause
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={handleEnable}
                    disabled={isEnabling || hasErrors || isDirty}
                  >
                    {isEnabling ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Enable
                  </Button>
                </span>
              </TooltipTrigger>
              {(hasErrors || isDirty) && (
                <TooltipContent side="bottom">
                  {hasErrors
                    ? `Fix ${errorCount} issue${errorCount > 1 ? "s" : ""} before enabling`
                    : "Save changes before enabling"}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
