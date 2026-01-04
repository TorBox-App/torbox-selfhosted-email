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

interface Topic {
  id: string;
  name: string;
}

interface WorkflowPropertiesPanelProps {
  templates: Template[];
  topics?: Topic[];
}

export function WorkflowPropertiesPanel({
  templates,
  topics = [],
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

        {data.type === "condition" && (
          <ConditionConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "update_contact" && (
          <UpdateContactConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "webhook" && (
          <WebhookConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "wait_for_event" && (
          <WaitForEventConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "subscribe_topic" && (
          <SubscribeTopicConfig
            config={data.config}
            topics={topics}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "unsubscribe_topic" && (
          <UnsubscribeTopicConfig
            config={data.config}
            topics={topics}
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
            <SelectItem value="segment_entry">Segment Entry</SelectItem>
            <SelectItem value="segment_exit">Segment Exit</SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
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

      {(config.triggerType === "segment_entry" ||
        config.triggerType === "segment_exit") && (
        <div className="space-y-2">
          <Label htmlFor="segment-id">Segment ID</Label>
          <Input
            id="segment-id"
            placeholder="Enter segment ID"
            value={config.segmentId || ""}
            onChange={(e) => onChange({ segmentId: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {config.triggerType === "segment_entry"
              ? "Workflow starts when a contact enters this segment."
              : "Workflow starts when a contact exits this segment."}
          </p>
        </div>
      )}

      {config.triggerType === "schedule" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="schedule-cron">Schedule (Cron)</Label>
            <Input
              id="schedule-cron"
              placeholder="e.g., 0 9 * * 1 (Monday 9am)"
              value={config.schedule || ""}
              onChange={(e) => onChange({ schedule: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Cron expression for when to run this workflow. Common patterns:
            </p>
            <ul className="text-xs text-muted-foreground ml-4 list-disc">
              <li>0 9 * * * - Daily at 9am</li>
              <li>0 9 * * 1 - Monday at 9am</li>
              <li>0 0 1 * * - First of month</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-timezone">Timezone</Label>
            <Select
              value={config.timezone || "UTC"}
              onValueChange={(value) => onChange({ timezone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Europe/Paris">Paris</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                <SelectItem value="Australia/Sydney">Sydney</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
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

// Condition configuration
function ConditionConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "condition") return null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="condition-field">Field</Label>
        <Input
          id="condition-field"
          placeholder="e.g., email, tags, customField"
          value={config.field || ""}
          onChange={(e) => onChange({ field: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Contact property to evaluate
        </p>
      </div>

      <div className="space-y-2">
        <Label>Operator</Label>
        <Select
          value={config.operator || "equals"}
          onValueChange={(value) => onChange({ operator: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="not_equals">Not Equals</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="not_contains">Not Contains</SelectItem>
            <SelectItem value="starts_with">Starts With</SelectItem>
            <SelectItem value="ends_with">Ends With</SelectItem>
            <SelectItem value="greater_than">Greater Than</SelectItem>
            <SelectItem value="less_than">Less Than</SelectItem>
            <SelectItem value="is_set">Is Set</SelectItem>
            <SelectItem value="is_not_set">Is Not Set</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.operator !== "is_set" && config.operator !== "is_not_set" && (
        <div className="space-y-2">
          <Label htmlFor="condition-value">Value</Label>
          <Input
            id="condition-value"
            placeholder="Value to compare"
            value={String(config.value ?? "")}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
      )}
    </>
  );
}

// Update Contact configuration
function UpdateContactConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "update_contact") return null;

  const updates = config.updates || [];

  const addUpdate = () => {
    onChange({
      updates: [...updates, { field: "", operation: "set", value: "" }],
    });
  };

  const removeUpdate = (index: number) => {
    onChange({
      updates: updates.filter((_, i) => i !== index),
    });
  };

  const updateField = (index: number, key: string, value: unknown) => {
    const newUpdates = [...updates];
    newUpdates[index] = { ...newUpdates[index], [key]: value };
    onChange({ updates: newUpdates });
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Field Updates</Label>
          <button
            type="button"
            onClick={addUpdate}
            className="text-xs text-primary hover:underline"
          >
            + Add field
          </button>
        </div>

        {updates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No updates configured. Click "Add field" to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {updates.map((update, index) => (
              <div key={index} className="p-3 border rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Update {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeUpdate(index)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <Input
                  placeholder="Field name"
                  value={update.field || ""}
                  onChange={(e) => updateField(index, "field", e.target.value)}
                />
                <Select
                  value={update.operation || "set"}
                  onValueChange={(value) => updateField(index, "operation", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Set to</SelectItem>
                    <SelectItem value="increment">Increment by</SelectItem>
                    <SelectItem value="decrement">Decrement by</SelectItem>
                    <SelectItem value="append">Append</SelectItem>
                    <SelectItem value="remove">Remove</SelectItem>
                    <SelectItem value="unset">Unset</SelectItem>
                  </SelectContent>
                </Select>
                {update.operation !== "unset" && (
                  <Input
                    placeholder="Value"
                    value={String(update.value ?? "")}
                    onChange={(e) => updateField(index, "value", e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Webhook configuration
function WebhookConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "webhook") return null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="webhook-url">URL</Label>
        <Input
          id="webhook-url"
          type="url"
          placeholder="https://api.example.com/webhook"
          value={config.url || ""}
          onChange={(e) => onChange({ url: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Method</Label>
        <Select
          value={config.method || "POST"}
          onValueChange={(value) => onChange({ method: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook-headers">Headers (JSON)</Label>
        <Textarea
          id="webhook-headers"
          placeholder='{"Authorization": "Bearer ..."}'
          value={config.headers ? JSON.stringify(config.headers, null, 2) : ""}
          onChange={(e) => {
            try {
              const headers = e.target.value ? JSON.parse(e.target.value) : undefined;
              onChange({ headers });
            } catch {
              // Invalid JSON, ignore
            }
          }}
          rows={3}
          className="font-mono text-xs"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Contact data will be sent in the request body automatically.
      </p>
    </>
  );
}

// Wait for Event configuration
function WaitForEventConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "wait_for_event") return null;

  // Convert timeout seconds to a human-readable format
  const getTimeoutValues = () => {
    const seconds = config.timeoutSeconds || 0;
    if (seconds >= 86400) {
      return { amount: Math.floor(seconds / 86400), unit: "days" };
    } else if (seconds >= 3600) {
      return { amount: Math.floor(seconds / 3600), unit: "hours" };
    } else if (seconds >= 60) {
      return { amount: Math.floor(seconds / 60), unit: "minutes" };
    }
    return { amount: seconds || 24, unit: "hours" };
  };

  const { amount, unit } = getTimeoutValues();

  const handleTimeoutChange = (newAmount: number, newUnit: string) => {
    let seconds = newAmount;
    switch (newUnit) {
      case "minutes":
        seconds = newAmount * 60;
        break;
      case "hours":
        seconds = newAmount * 3600;
        break;
      case "days":
        seconds = newAmount * 86400;
        break;
    }
    onChange({ timeoutSeconds: seconds });
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="wait-event-name">Event Name</Label>
        <Input
          id="wait-event-name"
          placeholder="e.g., purchase.completed"
          value={config.eventName || ""}
          onChange={(e) => onChange({ eventName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The event to wait for. Workflow continues when this event is received for the contact.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Timeout</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(e) =>
              handleTimeoutChange(Number.parseInt(e.target.value) || 1, unit)
            }
            className="w-20"
          />
          <Select
            value={unit}
            onValueChange={(value) => handleTimeoutChange(amount, value)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          If the event is not received within this time, the timeout path is followed.
        </p>
      </div>
    </>
  );
}

// Subscribe Topic configuration
function SubscribeTopicConfig({
  config,
  topics,
  onChange,
}: {
  config: WorkflowStepConfig;
  topics: { id: string; name: string }[];
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "subscribe_topic") return null;

  return (
    <>
      <div className="space-y-2">
        <Label>Topic</Label>
        <Select
          value={config.topicId || ""}
          onValueChange={(value) => onChange({ topicId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {topics.length === 0 && (
          <p className="text-xs text-gray-500">
            No topics available. Create one in Settings &gt; Topics.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Channel</Label>
        <Select
          value={config.channel || "email"}
          onValueChange={(value) =>
            onChange({ channel: value as "email" | "sms" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Subscribe the contact to receive messages via this channel.
        </p>
      </div>
    </>
  );
}

// Unsubscribe Topic configuration
function UnsubscribeTopicConfig({
  config,
  topics,
  onChange,
}: {
  config: WorkflowStepConfig;
  topics: { id: string; name: string }[];
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "unsubscribe_topic") return null;

  return (
    <>
      <div className="space-y-2">
        <Label>Topic</Label>
        <Select
          value={config.topicId || ""}
          onValueChange={(value) => onChange({ topicId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {topics.length === 0 && (
          <p className="text-xs text-gray-500">
            No topics available. Create one in Settings &gt; Topics.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Channel</Label>
        <Select
          value={config.channel || "email"}
          onValueChange={(value) =>
            onChange({ channel: value as "email" | "sms" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Unsubscribe the contact from receiving messages via this channel.
        </p>
      </div>
    </>
  );
}
