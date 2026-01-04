"use client";

import type { Workflow } from "@wraps/db";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { AIDesignPanel } from "./ai-design-panel";
import { useWorkflowStore } from "./use-workflow-store";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowDataProvider } from "./workflow-data-context";
import { WorkflowPropertiesPanel } from "./workflow-properties-panel";
import { WorkflowToolbar } from "./workflow-toolbar";

type Topic = {
  id: string;
  name: string;
};

type Segment = {
  id: string;
  name: string;
};

type AwsAccount = {
  id: string;
  name: string;
  region: string;
};

type WorkflowBuilderProps = {
  workflow: Workflow;
  organizationId: string;
  orgSlug: string;
  topics: Topic[];
  segments: Segment[];
  awsAccounts: AwsAccount[];
  userRole: string;
};

export function WorkflowBuilder({
  workflow,
  organizationId,
  orgSlug,
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
      <WorkflowDataProvider segments={segments} topics={topics}>
        <div className="flex h-full flex-col">
          <WorkflowToolbar
            organizationId={organizationId}
            orgSlug={orgSlug}
            workflow={workflow}
          />
          <div className="flex flex-1 overflow-hidden">
            <AIDesignPanel orgSlug={orgSlug} workflowId={workflow.id} />
            <WorkflowCanvas />
            <WorkflowPropertiesPanel
              orgSlug={orgSlug}
              segments={segments}
              topics={topics}
            />
          </div>
        </div>
      </WorkflowDataProvider>
    </ReactFlowProvider>
  );
}
