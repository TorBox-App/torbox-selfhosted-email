"use client";

import type { Workflow } from "@wraps/db";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { useWorkflowStore } from "./use-workflow-store";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowPropertiesPanel } from "./workflow-properties-panel";
import { WorkflowToolbar } from "./workflow-toolbar";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  status: string;
}

interface AwsAccount {
  id: string;
  name: string;
  region: string;
}

interface WorkflowBuilderProps {
  workflow: Workflow;
  organizationId: string;
  orgSlug: string;
  templates: Template[];
  awsAccounts: AwsAccount[];
  userRole: string;
}

export function WorkflowBuilder({
  workflow,
  organizationId,
  orgSlug,
  templates,
  awsAccounts,
  userRole,
}: WorkflowBuilderProps) {
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);

  useEffect(() => {
    setWorkflow(workflow);
  }, [workflow, setWorkflow]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-full">
        <WorkflowToolbar
          workflow={workflow}
          orgSlug={orgSlug}
          organizationId={organizationId}
        />
        <div className="flex-1 flex overflow-hidden">
          <WorkflowCanvas />
          <WorkflowPropertiesPanel templates={templates} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
