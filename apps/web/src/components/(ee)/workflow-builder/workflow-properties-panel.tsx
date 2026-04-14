"use client";

import type { WorkflowStepConfig } from "@wraps/db";
import { Alert, AlertDescription } from "@wraps/ui/components/ui/alert";
import { Label } from "@wraps/ui/components/ui/label";
import { AlertCircle, Settings, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { configComponents } from "./properties";
import { CascadeConfig } from "./properties/cascade-config";
import { TopicConfig } from "./properties/topic-config";
import {
  useSelectedNode,
  useValidationResult,
  useWorkflowStore,
} from "./use-workflow-store";

type WorkflowPropertiesPanelProps = {
  orgSlug: string;
  topics?: { id: string; name: string }[];
  segments?: { id: string; name: string }[];
};

export function WorkflowPropertiesPanel({
  orgSlug,
}: WorkflowPropertiesPanelProps) {
  const selectedNode = useSelectedNode();
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);
  const updateNodeName = useWorkflowStore((state) => state.updateNodeName);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const validationResult = useValidationResult();

  const nodeErrors = selectedNode
    ? validationResult?.errorsByNodeId.get(selectedNode.id) || []
    : [];

  if (!selectedNode) {
    return (
      <div className="flex w-80 items-center justify-center border-l bg-muted">
        <div className="text-center text-muted-foreground">
          <Settings className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">Select a node to configure</p>
        </div>
      </div>
    );
  }

  const { data } = selectedNode;

  const handleConfigChange = (updates: Partial<WorkflowStepConfig>) => {
    updateNodeConfig(selectedNode.id, updates);
  };

  const handleDelete = () => {
    deleteNode(selectedNode.id);
  };

  // Render the type-specific config component
  const renderConfig = () => {
    if (data.type === "cascade") {
      return (
        <CascadeConfig
          channels={data.cascadeChannels ?? []}
          nodeId={selectedNode.id}
          orgSlug={orgSlug}
        />
      );
    }

    if (data.type === "subscribe_topic" || data.type === "unsubscribe_topic") {
      return (
        <TopicConfig
          config={data.config}
          nodeId={selectedNode.id}
          onChange={handleConfigChange}
          onTypeChange={(newType) => {
            const currentConfig = data.config;
            updateNodeConfig(selectedNode.id, {
              type: newType,
              topicId:
                currentConfig.type === "subscribe_topic" ||
                currentConfig.type === "unsubscribe_topic"
                  ? currentConfig.topicId
                  : "",
              channel:
                currentConfig.type === "subscribe_topic" ||
                currentConfig.type === "unsubscribe_topic"
                  ? currentConfig.channel
                  : "email",
            } as WorkflowStepConfig);
          }}
          orgSlug={orgSlug}
        />
      );
    }

    const ConfigComponent = configComponents[data.type];
    if (ConfigComponent) {
      return (
        <ConfigComponent
          config={data.config}
          nodeId={selectedNode.id}
          onChange={handleConfigChange}
          orgSlug={orgSlug}
        />
      );
    }

    return null;
  };

  return (
    <div className="w-80 overflow-y-auto border-l bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-medium">Properties</h3>
        <Button
          aria-label="Close"
          onClick={() => selectNode(null)}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        {/* Validation errors */}
        {nodeErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-xs">
                {nodeErrors.map((error, i) => (
                  <li key={i}>• {error.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="node-name">Name</Label>
          <Input
            id="node-name"
            onChange={(e) => updateNodeName(selectedNode.id, e.target.value)}
            value={data.name}
          />
        </div>

        {/* Type-specific configuration */}
        {renderConfig()}

        {/* Delete button */}
        {data.type !== "trigger" && (
          <div className="border-t pt-4">
            <Button
              className="w-full"
              onClick={handleDelete}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {data.type === "cascade" ? "Delete Cascade" : "Delete Node"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
