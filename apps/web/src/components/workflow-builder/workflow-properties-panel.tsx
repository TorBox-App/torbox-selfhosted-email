"use client";

import type { WorkflowStepConfig } from "@wraps/db";
import { AlertCircle, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { useState } from "react";
import { TemplateEditorDialog } from "@/components/template-editor/wrappers/template-editor-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useTemplates } from "@/hooks/use-template-queries";
import {
  useSelectedNode,
  useValidationResult,
  useWorkflowStore,
} from "./use-workflow-store";

type Template = {
  id: string;
  name: string;
  subject: string | null;
  status: string;
};

type Topic = {
  id: string;
  name: string;
};

type Segment = {
  id: string;
  name: string;
};

type WorkflowPropertiesPanelProps = {
  orgSlug: string;
  topics?: Topic[];
  segments?: Segment[];
};

export function WorkflowPropertiesPanel({
  orgSlug,
  topics = [],
  segments = [],
}: WorkflowPropertiesPanelProps) {
  const selectedNode = useSelectedNode();
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);
  const updateNodeName = useWorkflowStore((state) => state.updateNodeName);

  // Fetch templates via React Query (auto-refreshes when new templates are created)
  const { data: templatesData } = useTemplates(orgSlug);
  const templates = templatesData ?? [];

  // Template editor dialog state
  const [showEditorDialog, setShowEditorDialog] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<
    string | undefined
  >();

  const handleCreateNewTemplate = () => {
    setEditingTemplateId(undefined);
    setShowEditorDialog(true);
  };

  const handleEditTemplate = (templateId: string) => {
    setEditingTemplateId(templateId);
    setShowEditorDialog(true);
  };

  const handleTemplateSelect = (templateId: string) => {
    // Update the node config with the new/edited template
    if (selectedNode) {
      updateNodeConfig(selectedNode.id, { templateId });
    }
    setShowEditorDialog(false);
  };
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const validationResult = useValidationResult();

  // Get validation errors for the selected node
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

  return (
    <div className="w-80 overflow-y-auto border-l bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-medium">Properties</h3>
        <Button onClick={() => selectNode(null)} size="icon" variant="ghost">
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
        {data.type === "trigger" && (
          <TriggerConfig
            config={data.config}
            onChange={handleConfigChange}
            segments={segments}
            topics={topics}
          />
        )}

        {data.type === "send_email" && (
          <SendEmailConfig
            config={data.config}
            onChange={handleConfigChange}
            onCreateNew={handleCreateNewTemplate}
            onEditTemplate={handleEditTemplate}
            templates={templates}
          />
        )}

        {data.type === "send_sms" && (
          <SendSmsConfig config={data.config} onChange={handleConfigChange} />
        )}

        {data.type === "delay" && (
          <DelayConfig config={data.config} onChange={handleConfigChange} />
        )}

        {data.type === "condition" && (
          <ConditionConfig config={data.config} onChange={handleConfigChange} />
        )}

        {data.type === "update_contact" && (
          <UpdateContactConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "webhook" && (
          <WebhookConfig config={data.config} onChange={handleConfigChange} />
        )}

        {data.type === "wait_for_event" && (
          <WaitForEventConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {data.type === "wait_for_email_engagement" && (
          <WaitForEmailEngagementConfig
            config={data.config}
            onChange={handleConfigChange}
          />
        )}

        {(data.type === "subscribe_topic" ||
          data.type === "unsubscribe_topic") && (
          <TopicConfig
            config={data.config}
            onChange={handleConfigChange}
            onTypeChange={(newType) => {
              // Switch between subscribe and unsubscribe types
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
            topics={topics}
          />
        )}

        {/* Delete button */}
        {data.type !== "trigger" && (
          <div className="border-t pt-4">
            <Button
              className="w-full"
              onClick={handleDelete}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Node
            </Button>
          </div>
        )}
      </div>

      {/* Template Editor Dialog */}
      <TemplateEditorDialog
        onOpenChange={setShowEditorDialog}
        onTemplateSelect={handleTemplateSelect}
        open={showEditorDialog}
        orgSlug={orgSlug}
        templateId={editingTemplateId}
        templateName={
          editingTemplateId ? undefined : `${selectedNode.data.name} Email`
        }
        title={editingTemplateId ? "Edit Template" : "Create Template"}
        variableContext="automation"
      />
    </div>
  );
}

// Trigger configuration
function TriggerConfig({
  config,
  topics,
  segments,
  onChange,
}: {
  config: WorkflowStepConfig;
  topics: { id: string; name: string }[];
  segments: { id: string; name: string }[];
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "trigger") {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Select
          onValueChange={(value) =>
            onChange({ triggerType: value as typeof config.triggerType })
          }
          value={config.triggerType}
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
            <SelectItem value="topic_subscribed">Topic Subscribed</SelectItem>
            <SelectItem value="topic_unsubscribed">
              Topic Unsubscribed
            </SelectItem>
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
            onChange={(e) => onChange({ eventName: e.target.value })}
            placeholder="e.g., user.signed_up"
            value={config.eventName || ""}
          />
          <p className="text-muted-foreground text-xs">
            The event that starts this workflow. Use your API to trigger it.
          </p>
        </div>
      )}

      {(config.triggerType === "segment_entry" ||
        config.triggerType === "segment_exit") && (
        <div className="space-y-2">
          <Label>Segment</Label>
          <Select
            onValueChange={(value) => onChange({ segmentId: value })}
            value={config.segmentId || ""}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a segment" />
            </SelectTrigger>
            <SelectContent>
              {segments.map((segment) => (
                <SelectItem key={segment.id} value={segment.id}>
                  {segment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {segments.length === 0 && (
            <p className="text-muted-foreground text-xs">
              No segments available. Create one in Contacts &gt; Segments.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {config.triggerType === "segment_entry"
              ? "Workflow starts when a contact enters this segment."
              : "Workflow starts when a contact exits this segment."}
          </p>
        </div>
      )}

      {(config.triggerType === "topic_subscribed" ||
        config.triggerType === "topic_unsubscribed") && (
        <div className="space-y-2">
          <Label>Topic</Label>
          <Select
            onValueChange={(value) => onChange({ topicId: value })}
            value={config.topicId || ""}
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
            <p className="text-muted-foreground text-xs">
              No topics available. Create one in Settings &gt; Topics.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {config.triggerType === "topic_subscribed"
              ? "Workflow starts when a contact subscribes to this topic."
              : "Workflow starts when a contact unsubscribes from this topic."}
          </p>
        </div>
      )}

      {config.triggerType === "schedule" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="schedule-cron">Schedule (Cron)</Label>
            <Input
              id="schedule-cron"
              onChange={(e) => onChange({ schedule: e.target.value })}
              placeholder="e.g., 0 9 * * 1 (Monday 9am)"
              value={config.schedule || ""}
            />
            <p className="text-muted-foreground text-xs">
              Cron expression for when to run this workflow. Common patterns:
            </p>
            <ul className="ml-4 list-disc text-muted-foreground text-xs">
              <li>0 9 * * * - Daily at 9am</li>
              <li>0 9 * * 1 - Monday at 9am</li>
              <li>0 0 1 * * - First of month</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-timezone">Timezone</Label>
            <Select
              onValueChange={(value) => onChange({ timezone: value })}
              value={config.timezone || "UTC"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">
                  Pacific Time
                </SelectItem>
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
  onCreateNew,
  onEditTemplate,
}: {
  config: WorkflowStepConfig;
  templates: Template[];
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
  onCreateNew?: () => void;
  onEditTemplate?: (templateId: string) => void;
}) {
  if (config.type !== "send_email") {
    return null;
  }

  const selectedTemplate = templates.find((t) => t.id === config.templateId);

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Email Template</Label>
          {onCreateNew && (
            <button
              className="flex items-center gap-1 text-primary text-xs hover:underline"
              onClick={onCreateNew}
              type="button"
            >
              <Plus className="h-3 w-3" />
              Create new
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Select
            onValueChange={(value) => {
              onChange({ templateId: value });
            }}
            value={config.templateId || ""}
          >
            <SelectTrigger className="flex-1">
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
          {config.templateId && onEditTemplate && (
            <Button
              onClick={() => onEditTemplate(config.templateId!)}
              size="icon"
              title="Edit template"
              variant="outline"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {templates.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No templates available.{" "}
            {onCreateNew && (
              <button
                className="text-primary hover:underline"
                onClick={onCreateNew}
                type="button"
              >
                Create one
              </button>
            )}
          </p>
        )}
        {selectedTemplate && (
          <p className="text-muted-foreground text-xs">
            Subject: {selectedTemplate.subject || "(no subject)"}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="from-name">From Name (optional)</Label>
        <Input
          id="from-name"
          onChange={(e) => onChange({ fromName: e.target.value })}
          placeholder="e.g., Acme Team"
          value={config.fromName || ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply-to">Reply To (optional)</Label>
        <Input
          id="reply-to"
          onChange={(e) => onChange({ replyTo: e.target.value })}
          placeholder="e.g., support@acme.com"
          type="email"
          value={config.replyTo || ""}
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
  if (config.type !== "send_sms") {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="sms-body">Message</Label>
      <Textarea
        id="sms-body"
        onChange={(e) => onChange({ body: e.target.value })}
        placeholder="Enter your SMS message..."
        rows={4}
        value={config.body || ""}
      />
      <p className="text-muted-foreground text-xs">
        {config.body?.length || 0} / 160 characters
      </p>
    </div>
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
  if (config.type !== "delay") {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="delay-amount">Duration</Label>
      <div className="flex gap-2">
        <Input
          className="w-20"
          id="delay-amount"
          min={1}
          onChange={(e) =>
            onChange({ amount: Number.parseInt(e.target.value, 10) || 1 })
          }
          type="number"
          value={config.amount || 1}
        />
        <Select
          onValueChange={(value) =>
            onChange({ unit: value as typeof config.unit })
          }
          value={config.unit || "days"}
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
  if (config.type !== "condition") {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="condition-field">Field</Label>
        <Input
          id="condition-field"
          onChange={(e) => onChange({ field: e.target.value })}
          placeholder="e.g., email, tags, customField"
          value={config.field || ""}
        />
        <p className="text-muted-foreground text-xs">
          Contact property to evaluate
        </p>
      </div>

      <div className="space-y-2">
        <Label>Operator</Label>
        <Select
          onValueChange={(value) => onChange({ operator: value })}
          value={config.operator || "equals"}
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
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Value to compare"
            value={String(config.value ?? "")}
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
  if (config.type !== "update_contact") {
    return null;
  }

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Field Updates</Label>
        <button
          className="text-primary text-xs hover:underline"
          onClick={addUpdate}
          type="button"
        >
          + Add field
        </button>
      </div>

      {updates.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No updates configured. Click "Add field" to add one.
        </p>
      ) : (
        <div className="space-y-3">
          {updates.map((update, index) => (
            <div className="space-y-2 rounded-md border p-3" key={index}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs">Update {index + 1}</span>
                <button
                  className="text-destructive text-xs hover:underline"
                  onClick={() => removeUpdate(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              <Input
                onChange={(e) => updateField(index, "field", e.target.value)}
                placeholder="Field name"
                value={update.field || ""}
              />
              <Select
                onValueChange={(value) =>
                  updateField(index, "operation", value)
                }
                value={update.operation || "set"}
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
                  onChange={(e) => updateField(index, "value", e.target.value)}
                  placeholder="Value"
                  value={String(update.value ?? "")}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
  if (config.type !== "webhook") {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="webhook-url">URL</Label>
        <Input
          id="webhook-url"
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://api.example.com/webhook"
          type="url"
          value={config.url || ""}
        />
      </div>

      <div className="space-y-2">
        <Label>Method</Label>
        <Select
          onValueChange={(value) => onChange({ method: value })}
          value={config.method || "POST"}
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
          className="font-mono text-xs"
          id="webhook-headers"
          onChange={(e) => {
            try {
              const headers = e.target.value
                ? JSON.parse(e.target.value)
                : undefined;
              onChange({ headers });
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='{"Authorization": "Bearer ..."}'
          rows={3}
          value={config.headers ? JSON.stringify(config.headers, null, 2) : ""}
        />
      </div>

      <p className="text-muted-foreground text-xs">
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
  if (config.type !== "wait_for_event") {
    return null;
  }

  // Convert timeout seconds to a human-readable format
  const getTimeoutValues = () => {
    const seconds = config.timeoutSeconds || 0;
    if (seconds >= 86_400) {
      return { amount: Math.floor(seconds / 86_400), unit: "days" };
    }
    if (seconds >= 3600) {
      return { amount: Math.floor(seconds / 3600), unit: "hours" };
    }
    if (seconds >= 60) {
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
        seconds = newAmount * 86_400;
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
          onChange={(e) => onChange({ eventName: e.target.value })}
          placeholder="e.g., purchase.completed"
          value={config.eventName || ""}
        />
        <p className="text-muted-foreground text-xs">
          The event to wait for. Workflow continues when this event is received
          for the contact.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Timeout</Label>
        <div className="flex gap-2">
          <Input
            className="w-20"
            min={1}
            onChange={(e) =>
              handleTimeoutChange(
                Number.parseInt(e.target.value, 10) || 1,
                unit
              )
            }
            type="number"
            value={amount}
          />
          <Select
            onValueChange={(value) => handleTimeoutChange(amount, value)}
            value={unit}
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
        <p className="text-muted-foreground text-xs">
          If the event is not received within this time, the timeout path is
          followed.
        </p>
      </div>
    </>
  );
}

// Wait for Email Engagement configuration
function WaitForEmailEngagementConfig({
  config,
  onChange,
}: {
  config: WorkflowStepConfig;
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
}) {
  if (config.type !== "wait_for_email_engagement") {
    return null;
  }

  // Convert timeout seconds to a human-readable format
  const getTimeoutValues = () => {
    const seconds = config.timeoutSeconds || 0;
    if (seconds >= 86_400) {
      return { amount: Math.floor(seconds / 86_400), unit: "days" };
    }
    if (seconds >= 3600) {
      return { amount: Math.floor(seconds / 3600), unit: "hours" };
    }
    if (seconds >= 60) {
      return { amount: Math.floor(seconds / 60), unit: "minutes" };
    }
    return { amount: seconds || 3, unit: "days" };
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
        seconds = newAmount * 86_400;
        break;
    }
    onChange({ timeoutSeconds: seconds });
  };

  return (
    <>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          Waits for engagement with the previous Send Email step. Routes
          contacts based on whether they opened, clicked, or if the email
          bounced.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Wait Duration</Label>
        <div className="flex gap-2">
          <Input
            className="w-20"
            min={1}
            onChange={(e) =>
              handleTimeoutChange(
                Number.parseInt(e.target.value, 10) || 1,
                unit
              )
            }
            type="number"
            value={amount}
          />
          <Select
            onValueChange={(value) => handleTimeoutChange(amount, value)}
            value={unit}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs">
          Time to wait for engagement before following the "None" path.
        </p>
      </div>

      <div className="space-y-1 rounded-md bg-muted p-3">
        <p className="font-medium text-xs">Output Paths:</p>
        <ul className="space-y-0.5 text-muted-foreground text-xs">
          <li>
            <span className="font-medium text-green-600">Open</span> — Email was
            opened
          </li>
          <li>
            <span className="font-medium text-blue-600">Click</span> — Link was
            clicked
          </li>
          <li>
            <span className="font-medium text-red-600">Bounce</span> — Email
            bounced
          </li>
          <li>
            <span className="font-medium text-yellow-600">None</span> — No
            engagement within timeout
          </li>
        </ul>
      </div>
    </>
  );
}

// Topic configuration (combined subscribe/unsubscribe)
function TopicConfig({
  config,
  topics,
  onChange,
  onTypeChange,
}: {
  config: WorkflowStepConfig;
  topics: { id: string; name: string }[];
  onChange: (updates: Partial<WorkflowStepConfig>) => void;
  onTypeChange: (type: "subscribe_topic" | "unsubscribe_topic") => void;
}) {
  if (
    config.type !== "subscribe_topic" &&
    config.type !== "unsubscribe_topic"
  ) {
    return null;
  }

  const isSubscribe = config.type === "subscribe_topic";

  return (
    <>
      <div className="space-y-2">
        <Label>Action</Label>
        <Select
          onValueChange={(value) =>
            onTypeChange(value as "subscribe_topic" | "unsubscribe_topic")
          }
          value={config.type}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscribe_topic">Subscribe</SelectItem>
            <SelectItem value="unsubscribe_topic">Unsubscribe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Topic</Label>
        <Select
          onValueChange={(value) => onChange({ topicId: value })}
          value={config.topicId || ""}
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
          <p className="text-muted-foreground text-xs">
            No topics available. Create one in Settings &gt; Topics.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Channel</Label>
        <Select
          onValueChange={(value) =>
            onChange({ channel: value as "email" | "sms" })
          }
          value={config.channel || "email"}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {isSubscribe
            ? "Subscribe the contact to receive messages via this channel."
            : "Unsubscribe the contact from receiving messages via this channel."}
        </p>
      </div>
    </>
  );
}
