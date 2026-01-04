"use client";

import type { WorkflowStepConfig } from "@wraps/db";
import { Settings, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSelectedNode, useWorkflowStore } from "./use-workflow-store";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  status: string;
}

interface WorkflowPropertiesPanelProps {
  templates: Template[];
}

export function WorkflowPropertiesPanel({
  templates,
}: WorkflowPropertiesPanelProps) {
  const selectedNode = useSelectedNode();
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);
  const updateNodeName = useWorkflowStore((state) => state.updateNodeName);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);

  if (!selectedNode) {
    return (
      <div className="w-80 border-l bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
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

  return (
    <div className="w-80 border-l bg-white overflow-y-auto">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-medium">Properties</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => selectNode(null)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="node-name">Name</Label>
          <Input
            id="node-name"
            value={data.name}
            onChange={(e) => updateNodeName(selectedNode.id, e.target.value)}
          />
        </div>

        {/* Type-specific configuration */}
        {data.type === "trigger" && (
          <TriggerConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "send_email" && (
          <SendEmailConfig
            config={data.config}
            templates={templates}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "send_sms" && (
          <SendSmsConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "delay" && (
          <DelayConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {/* Delete button */}
        {data.type !== "trigger" && (
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Node
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Trigger configuration
function TriggerConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "trigger") return null;

  return (
    <>
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Select
          value={config.triggerType}
          onValueChange={(value) =>
            onChange({ triggerType: value as typeof config.triggerType })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contact_created">Contact Created</SelectItem>
            <SelectItem value="contact_updated">Contact Updated</SelectItem>
            <SelectItem value="event">Custom Event</SelectItem>
            <SelectItem value="api">API Trigger</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.triggerType === "event" && (
        <div className="space-y-2">
          <Label htmlFor="event-name">Event Name</Label>
          <Input
            id="event-name"
            placeholder="e.g., user.signed_up"
            value={config.eventName || ""}
            onChange={(e) => onChange({ eventName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            The event that starts this workflow. Use your API to trigger it.
          </p>
        </div>
      )}
    </>
  );
}

// Send Email configuration
function SendEmailConfig({
  config,
  templates,
  onChange,
}: {
  config: WorkflowStepConfig;
  templates: Template[];
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "send_email") return null;

  return (
    <>
      <div className="space-y-2">
        <Label>Email Template</Label>
        <Select
          value={config.templateId || ""}
          onValueChange={(value) => {
            onChange({ templateId: value });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {templates.length === 0 && (
          <p className="text-xs text-gray-500">
            No templates available. Create one first.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="from-name">From Name (optional)</Label>
        <Input
          id="from-name"
          placeholder="e.g., Acme Team"
          value={config.fromName || ""}
          onChange={(e) => onChange({ fromName: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply-to">Reply To (optional)</Label>
        <Input
          id="reply-to"
          type="email"
          placeholder="e.g., support@acme.com"
          value={config.replyTo || ""}
          onChange={(e) => onChange({ replyTo: e.target.value })}
        />
      </div>
    </>
  );
}

// Send SMS configuration
function SendSmsConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "send_sms") return null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="sms-body">Message</Label>
        <Textarea
          id="sms-body"
          placeholder="Enter your SMS message..."
          value={config.body || ""}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={4}
        />
        <p className="text-xs text-gray-500">
          {(config.body?.length || 0)} / 160 characters
        </p>
      </div>
    </>
  );
}

// Delay configuration
function DelayConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "delay") return null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="delay-amount">Duration</Label>
        <div className="flex gap-2">
          <Input
            id="delay-amount"
            type="number"
            min={1}
            value={config.amount || 1}
            onChange={(e) =>
              onChange({ amount: Number.parseInt(e.target.value) || 1 })
            }
            className="w-20"
          />
          <Select
            value={config.unit || "days"}
            onValueChange={(value) =>
              onChange({ unit: value as typeof config.unit })
            }
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="weeks">Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
