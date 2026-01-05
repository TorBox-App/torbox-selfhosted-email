import type { Workflow, WorkflowStatus } from "@wraps/db";

/**
 * Workflow status labels for display
 */
export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: "Draft",
  enabled: "Enabled",
  paused: "Paused",
  archived: "Archived",
};

/**
 * Workflow status colors for badges
 */
export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  enabled: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

/**
 * Get the number of steps in a workflow (excluding trigger)
 */
export function getStepCount(workflow: Workflow): number {
  const steps = workflow.steps as Array<{ type: string }>;
  return steps.filter((s) => s.type !== "trigger").length;
}

/**
 * Get a human-readable trigger description
 */
export function getTriggerDescription(workflow: Workflow): string {
  const triggerType = workflow.triggerType;
  const config = workflow.triggerConfig as Record<string, unknown> | null;

  switch (triggerType) {
    case "contact_created":
      return "When contact is created";
    case "contact_updated":
      return "When contact is updated";
    case "event":
      return config?.eventName
        ? `When "${config.eventName}" occurs`
        : "Custom event (not configured)";
    case "segment_entry":
      return "When contact enters segment";
    case "segment_exit":
      return "When contact exits segment";
    case "schedule":
      return config?.schedule
        ? `On schedule: ${config.schedule}`
        : "Scheduled (not configured)";
    case "api":
      return "Manual API trigger";
    case "topic_subscribed":
      return config?.topicName
        ? `When subscribed to "${config.topicName}"`
        : "When subscribed to topic";
    case "topic_unsubscribed":
      return config?.topicName
        ? `When unsubscribed from "${config.topicName}"`
        : "When unsubscribed from topic";
    default:
      return "Unknown trigger";
  }
}
