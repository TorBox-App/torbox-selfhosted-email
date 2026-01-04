"use client";

import type { Workflow } from "@wraps/db";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { useWorkflowStore } from "./use-workflow-store";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowDataProvider } from "./workflow-data-context";
import { WorkflowPropertiesPanel } from "./workflow-properties-panel";
import { WorkflowToolbar } from "./workflow-toolbar";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  status: string;
}

interface Topic {
  id: string;
  name: string;
}

interface Segment {
  id: string;
  name: string;
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
  topics: Topic[];
  segments: Segment[];
  awsAccounts: AwsAccount[];
  userRole: string;
}

export function WorkflowBuilder({
  workflow,
  organizationId,
  orgSlug,
  templates,
  topics,
  segments,
  awsAccounts,
  userRole,
}: WorkflowBuilderProps) {
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);

  useEffect(() => {
    setWorkflow(workflow);
  }, [workflow, setWorkflow]);

  return (
    <ReactFlowProvider>
      <WorkflowDataProvider topics={topics} segments={segments}>
        <div className="flex flex-col h-full">
          <WorkflowToolbar
            workflow={workflow}
            orgSlug={orgSlug}
            organizationId={organizationId}
          />
          <div className="flex-1 flex overflow-hidden">
            <WorkflowCanvas />
            <WorkflowPropertiesPanel templates={templates} topics={topics} segments={segments} />
          </div>
        </div>
      </WorkflowDataProvider>
    </ReactFlowProvider>
  );
}
