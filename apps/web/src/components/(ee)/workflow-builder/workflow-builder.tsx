"use client";

import type { Workflow, WorkflowStep, WorkflowTransition } from "@wraps/db";
import { ReactFlowProvider } from "@xyflow/react";
import { useRef } from "react";
import { AIDesignPanel } from "./ai-design-panel";
import { useWorkflowNodeStats } from "./hooks/use-workflow-node-stats";
import { useSettingsPanelOpen, useWorkflowStore } from "./use-workflow-store";
import { WorkflowCanvas } from "./workflow-canvas";
import { useWorkflowData, WorkflowDataProvider } from "./workflow-data-context";
import { WorkflowPropertiesPanel } from "./workflow-properties-panel";
import { WorkflowSettingsPanel } from "./workflow-settings-panel";
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
  smsEnabled?: boolean;
};

type OrgDefaults = {
  defaultAwsAccountId: string | null;
  defaultFrom: string | null;
  defaultFromName: string | null;
  defaultReplyTo: string | null;
  defaultSenderId: string | null;
} | null;

type WorkflowBuilderProps = {
  workflow: Workflow;
  organizationId: string;
  orgSlug: string;
  topics: Topic[];
  segments: Segment[];
  awsAccounts: AwsAccount[];
  orgDefaults: OrgDefaults;
  userRole: string;
};

/**
 * Fetches node stats when the stats toggle is on and executions exist.
 * Must be rendered inside WorkflowDataProvider.
 */
function StatsQueryLoader({
  workflowId,
  organizationId,
  totalExecutions,
}: {
  workflowId: string;
  organizationId: string;
  totalExecutions: number;
}) {
  const { showStats } = useWorkflowData();
  useWorkflowNodeStats(
    workflowId,
    organizationId,
    showStats && totalExecutions > 0
  );
  return null;
}

export function WorkflowBuilder({
  workflow,
  organizationId,
  orgSlug,
  topics,
  segments,
  awsAccounts,
  orgDefaults,
  userRole,
}: WorkflowBuilderProps) {
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  const settingsPanelOpen = useSettingsPanelOpen();
  const setSettingsPanelOpen = useWorkflowStore(
    (state) => state.setSettingsPanelOpen
  );
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);

  // Initialize store with workflow data once (and on workflow ID change)
  const initializedForId = useRef<string | null>(null);
  if (initializedForId.current !== workflow.id) {
    initializedForId.current = workflow.id;
    setWorkflow(workflow);

    // Auto-open settings panel for new workflows (only trigger node, no transitions)
    const steps = workflow.steps as WorkflowStep[];
    const transitions = workflow.transitions as WorkflowTransition[];
    if (steps.length <= 1 && transitions.length === 0) {
      setSettingsPanelOpen(true);
    }
  }

  return (
    <ReactFlowProvider>
      <WorkflowDataProvider
        segments={segments}
        topics={topics}
        workflowId={workflow.id}
      >
        <StatsQueryLoader
          organizationId={organizationId}
          totalExecutions={workflow.totalExecutions}
          workflowId={workflow.id}
        />
        <div className="flex h-full flex-col">
          <WorkflowToolbar
            organizationId={organizationId}
            orgSlug={orgSlug}
            workflow={workflow}
          />
          <div className="flex flex-1 overflow-hidden">
            <AIDesignPanel orgSlug={orgSlug} workflowId={workflow.id} />
            <WorkflowCanvas
              smsEnabled={awsAccounts.some((a) => a.smsEnabled)}
            />
            {settingsPanelOpen && !selectedNodeId ? (
              <WorkflowSettingsPanel
                awsAccounts={awsAccounts}
                onClose={() => setSettingsPanelOpen(false)}
                organizationId={organizationId}
                orgDefaults={orgDefaults}
                orgSlug={orgSlug}
                workflow={workflow}
              />
            ) : (
              <WorkflowPropertiesPanel
                orgSlug={orgSlug}
                segments={segments}
                topics={topics}
              />
            )}
          </div>
        </div>
      </WorkflowDataProvider>
    </ReactFlowProvider>
  );
}
