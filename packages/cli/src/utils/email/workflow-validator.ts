/**
 * Workflow Validator
 *
 * Validates transformed workflows for the CLI.
 * Wraps the existing workflow validation logic and adds template reference validation.
 */

import type {
  TransformedWorkflow,
  WorkflowStep,
  WorkflowTransition,
} from "./workflow-transform.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ValidationError = {
  nodeId?: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
  errorsByNodeId: Map<string, ValidationError[]>;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VALIDATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a transformed workflow.
 *
 * @param transformed - The transformed workflow to validate
 * @param localTemplateSlugs - Set of template slugs available locally (for reference validation)
 * @returns ValidationResult with errors and warnings
 */
export function validateTransformedWorkflow(
  transformed: TransformedWorkflow,
  localTemplateSlugs?: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Run structural validation
  errors.push(...validateStructure(transformed.steps, transformed.transitions));

  // 2. Run step-specific validation
  for (const step of transformed.steps) {
    errors.push(...validateStep(step));
  }

  // 3. Validate template references if local templates provided
  if (localTemplateSlugs) {
    errors.push(
      ...validateTemplateReferences(transformed.steps, localTemplateSlugs)
    );
  }

  // Group errors by nodeId
  const errorsByNodeId = new Map<string, ValidationError[]>();
  for (const error of errors) {
    if (error.nodeId) {
      const existing = errorsByNodeId.get(error.nodeId) || [];
      existing.push(error);
      errorsByNodeId.set(error.nodeId, existing);
    }
  }

  return {
    isValid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
    errorsByNodeId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function validateStructure(
  steps: WorkflowStep[],
  transitions: WorkflowTransition[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for trigger node
  const triggerSteps = steps.filter((s) => s.type === "trigger");
  if (triggerSteps.length === 0) {
    errors.push({
      message: "Workflow must have a trigger node",
      severity: "error",
    });
  } else if (triggerSteps.length > 1) {
    errors.push({
      message: "Workflow can only have one trigger node",
      severity: "error",
    });
  }

  // Check for at least one action step (not trigger, not exit)
  const actionSteps = steps.filter(
    (s) => s.type !== "trigger" && s.type !== "exit"
  );
  if (actionSteps.length === 0 && steps.length > 1) {
    errors.push({
      message: "Workflow must have at least one action step",
      severity: "error",
    });
  }

  // Check for orphan nodes (not reachable from trigger)
  if (triggerSteps.length === 1) {
    const reachableIds = getReachableNodeIds(triggerSteps[0].id, transitions);
    const orphanSteps = steps.filter(
      (s) => s.type !== "trigger" && !reachableIds.has(s.id)
    );
    for (const orphan of orphanSteps) {
      errors.push({
        nodeId: orphan.id,
        message: `"${orphan.name}" is not connected to the workflow`,
        severity: "warning",
      });
    }
  }

  // Check for invalid transition references
  const stepIds = new Set(steps.map((s) => s.id));
  for (const transition of transitions) {
    if (!stepIds.has(transition.fromStepId)) {
      errors.push({
        message: `Transition references non-existent source step: ${transition.fromStepId}`,
        severity: "error",
      });
    }
    if (!stepIds.has(transition.toStepId)) {
      errors.push({
        message: `Transition references non-existent target step: ${transition.toStepId}`,
        severity: "error",
      });
    }
  }

  return errors;
}

function getReachableNodeIds(
  startId: string,
  transitions: WorkflowTransition[]
): Set<string> {
  const reachable = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (reachable.has(currentId)) {
      continue;
    }
    reachable.add(currentId);

    // Find all nodes this one connects to
    const outgoing = transitions.filter((t) => t.fromStepId === currentId);
    for (const t of outgoing) {
      if (!reachable.has(t.toStepId)) {
        queue.push(t.toStepId);
      }
    }
  }

  return reachable;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP-SPECIFIC VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function validateStep(step: WorkflowStep): ValidationError[] {
  const errors: ValidationError[] = [];
  const config = step.config as Record<string, unknown>;
  const configType = config.type as string;

  switch (configType) {
    case "trigger":
      errors.push(...validateTrigger(step.id, config));
      break;
    case "send_email":
      errors.push(...validateSendEmail(step.id, config));
      break;
    case "condition":
      errors.push(...validateCondition(step.id, config));
      break;
    case "webhook":
      errors.push(...validateWebhook(step.id, config));
      break;
    case "subscribe_topic":
    case "unsubscribe_topic":
      errors.push(...validateTopic(step.id, config));
      break;
    case "wait_for_event":
      errors.push(...validateWaitForEvent(step.id, config));
      break;
    case "delay":
      errors.push(...validateDelay(step.id, config));
      break;
    // send_sms, exit, update_contact, wait_for_email_engagement - no required fields
  }

  return errors;
}

function validateTrigger(
  nodeId: string,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (config.triggerType) {
    case "event":
      if (!config.eventName) {
        errors.push({
          nodeId,
          field: "eventName",
          message: "Event name is required",
          severity: "error",
        });
      }
      break;
    case "segment_entry":
    case "segment_exit":
      if (!config.segmentId) {
        errors.push({
          nodeId,
          field: "segmentId",
          message: "Segment is required",
          severity: "error",
        });
      }
      break;
    case "topic_subscribed":
    case "topic_unsubscribed":
      if (!config.topicId) {
        errors.push({
          nodeId,
          field: "topicId",
          message: "Topic is required",
          severity: "error",
        });
      }
      break;
    case "schedule":
      if (!config.schedule) {
        errors.push({
          nodeId,
          field: "schedule",
          message: "Schedule (cron expression) is required",
          severity: "error",
        });
      }
      if (!config.timezone) {
        errors.push({
          nodeId,
          field: "timezone",
          message: "Timezone is required",
          severity: "error",
        });
      }
      break;
    // contact_created, contact_updated, api - no additional config needed
  }

  return errors;
}

function validateSendEmail(
  nodeId: string,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Accept either templateId (DB format) or template (user format)
  const templateRef =
    (config.templateId as string) || (config.template as string);
  if (!templateRef) {
    errors.push({
      nodeId,
      field: "templateId",
      message: "Email template is required",
      severity: "error",
    });
  }

  return errors;
}

function validateCondition(
  nodeId: string,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.field) {
    errors.push({
      nodeId,
      field: "field",
      message: "Condition field is required",
      severity: "error",
    });
  }

  if (!config.operator) {
    errors.push({
      nodeId,
      field: "operator",
      message: "Condition operator is required",
      severity: "error",
    });
  }

  // Value is required unless operator is is_set, is_not_set, is_true, or is_false
  if (
    config.operator !== "is_set" &&
    config.operator !== "is_not_set" &&
    config.operator !== "is_true" &&
    config.operator !== "is_false" &&
    (config.value === undefined || config.value === "")
  ) {
    errors.push({
      nodeId,
      field: "value",
      message: "Condition value is required",
      severity: "error",
    });
  }

  return errors;
}

function validateWebhook(
  nodeId: string,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.url) {
    // Basic URL validation
    try {
      new URL(config.url as string);
    } catch {
      errors.push({
        nodeId,
        field: "url",
        message: "Invalid URL format",
        severity: "error",
      });
    }
  } else {
    errors.push({
      nodeId,
      field: "url",
      message: "Webhook URL is required",
      severity: "error",
    });
  }

  return errors;
}

function validateTopic(
  nodeId: string,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.topicId) {
    errors.push({
      nodeId,
      field: "topicId",
      message: "Topic is required",
      severity: "error",
    });
  }

  return errors;
}

function validateWaitForEvent(
  nodeId: string,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.eventName) {
    errors.push({
      nodeId,
      field: "eventName",
      message: "Event name is required",
      severity: "error",
    });
  }

  return errors;
}

function validateDelay(
  nodeId: string,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const amount = config.amount as number | undefined;
  if (!amount || amount < 1) {
    errors.push({
      nodeId,
      field: "amount",
      message: "Delay duration must be at least 1",
      severity: "error",
    });
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE REFERENCE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that all template references exist locally.
 */
function validateTemplateReferences(
  steps: WorkflowStep[],
  localTemplateSlugs: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const step of steps) {
    if (step.config.type === "send_email") {
      const config = step.config as { templateId?: string; template?: string };
      const templateRef = config.templateId || config.template;

      if (templateRef && !localTemplateSlugs.has(templateRef)) {
        errors.push({
          nodeId: step.id,
          field: "templateId",
          message: `Template "${templateRef}" not found in templates/ directory`,
          severity: "error",
        });
      }
    }

    if (step.config.type === "send_sms") {
      const config = step.config as { templateId?: string; template?: string };
      const templateRef = config.templateId || config.template;

      if (templateRef && !localTemplateSlugs.has(templateRef)) {
        errors.push({
          nodeId: step.id,
          field: "templateId",
          message: `SMS template "${templateRef}" not found in templates/ directory`,
          severity: "warning", // Warning for SMS since we might not have SMS templates yet
        });
      }
    }
  }

  return errors;
}
