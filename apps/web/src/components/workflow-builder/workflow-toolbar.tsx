"use client";

import type { Workflow } from "@wraps/db";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateWorkflow } from "@/actions/workflows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsDirty, useIsSaving, useWorkflowStore } from "./use-workflow-store";

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
  const isDirty = useIsDirty();
  const isSaving = useIsSaving();
  const getWorkflowDefinition = useWorkflowStore(
    (state) => state.getWorkflowDefinition
  );
  const setIsSaving = useWorkflowStore((state) => state.setIsSaving);
  const updateWorkflowAfterSave = useWorkflowStore((state) => state.updateWorkflowAfterSave);
  const workflowState = useWorkflowStore((state) => state.workflow);

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
            <h1 className="font-semibold">{workflowState?.name || workflow.name}</h1>
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
      <div className="flex items-center gap-2">
        <Button
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
      </div>
    </div>
  );
}
