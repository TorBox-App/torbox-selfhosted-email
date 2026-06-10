import type {
  Workflow,
  WorkflowExecutionStatus,
  WorkflowStatus,
  WorkflowStepExecutionStatus,
} from "@wraps/db";

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

export const EXECUTION_STATUS_LABELS: Record<WorkflowExecutionStatus, string> =
  {
    pending: "Pending",
    active: "Active",
    paused: "Paused",
    waiting: "Waiting",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };

export const EXECUTION_STATUS_COLORS: Record<WorkflowExecutionStatus, string> =
  {
    pending: "bg-gray-100 text-gray-700",
    active: "bg-blue-100 text-blue-700",
    paused: "bg-yellow-100 text-yellow-700",
    waiting: "bg-purple-100 text-purple-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

export const STEP_STATUS_LABELS: Record<WorkflowStepExecutionStatus, string> = {
  pending: "Pending",
  executing: "Executing",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
};

export const STEP_STATUS_COLORS: Record<WorkflowStepExecutionStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  executing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-500",
};

// Ordered error-message patterns mapped to a stable code and a user-facing
// remediation hint. These mirror the errors thrown by the step handlers
// (see apps/api workflow-step-handlers.ts). Order matters: template_empty is
// checked before template_deleted so a compiled-HTML error never falls through
// to the broader "not found" match.
const WORKFLOW_ERROR_PATTERNS: ReadonlyArray<{
  code: string;
  test: RegExp;
  remediation: string;
}> = [
  {
    code: "aws_account_missing",
    test: /AWS account.*not found/i,
    remediation: "Reconnect your AWS account in Settings → AWS Accounts",
  },
  {
    code: "template_empty",
    test: /Template.*no compiled HTML/i,
    remediation: "Publish the email template before retrying",
  },
  {
    code: "template_deleted",
    test: /Template.*not found/i,
    remediation: "Restore or recreate the email template, then retry",
  },
  {
    code: "ses_permission",
    // Matches the send handler's "…does not have permission to send emails…"
    // plus generic IAM/authorization wording. Deliberately avoids bare "SES"
    // so retryable contract errors (e.g. "SES SendEmail returned no
    // MessageId") still fall through to transient.
    test: /does not have permission|permission to send|not authorized|access denied|SES.*permission/i,
    remediation: "Check SES send permissions for your AWS IAM role",
  },
];

/**
 * Classify a workflow execution error string into a stable code plus a
 * user-facing remediation hint so the execution detail page can tell the user
 * what to do instead of only showing the raw error. Matching is
 * case-insensitive and falls back to "transient" — a safe default that nudges
 * the user to just retry.
 */
export function classifyWorkflowError(error: string): {
  code: string;
  remediation: string;
} {
  for (const { code, test, remediation } of WORKFLOW_ERROR_PATTERNS) {
    if (test.test(error)) {
      return { code, remediation };
    }
  }

  return {
    code: "transient",
    remediation: "This looks like a transient error — safe to retry",
  };
}

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
