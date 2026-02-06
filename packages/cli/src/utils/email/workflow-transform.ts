/**
 * Workflow Transformer
 *
 * Transforms the user-friendly nested workflow definition (with inline branches)
 * into the flat format expected by the database and execution engine.
 *
 * Input: WorkflowDefinition with nested steps and inline branches
 * Output: Flat arrays of WorkflowStep[] and WorkflowTransition[]
 */

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL TYPE DEFINITIONS
// These mirror the types from @wraps.dev/email and @wraps/db but are defined
// locally to avoid dependency issues in the CLI.
// ═══════════════════════════════════════════════════════════════════════════

/** Workflow step types */
export type WorkflowStepType =
  | "trigger"
  | "send_email"
  | "send_sms"
  | "delay"
  | "exit"
  | "condition"
  | "webhook"
  | "update_contact"
  | "wait_for_event"
  | "wait_for_email_engagement"
  | "subscribe_topic"
  | "unsubscribe_topic";

/** Trigger types */
export type WorkflowTriggerType =
  | "event"
  | "contact_created"
  | "contact_updated"
  | "segment_entry"
  | "segment_exit"
  | "schedule"
  | "api"
  | "topic_subscribed"
  | "topic_unsubscribed";

/** Trigger configuration */
export type TriggerConfig = {
  eventName?: string;
  segmentId?: string;
  schedule?: string;
  timezone?: string;
  topicId?: string;
};

/** Trigger definition from user */
export type TriggerDefinition = {
  type: WorkflowTriggerType;
  eventName?: string;
  segmentId?: string;
  schedule?: string;
  timezone?: string;
  topicId?: string;
};

/** Step definition from user (with nested branches) */
export type StepDefinition = {
  id: string;
  type: WorkflowStepType;
  name?: string;
  config: Record<string, unknown>;
  branches?: {
    yes?: StepDefinition[];
    no?: StepDefinition[];
  };
};

/** Workflow definition from user */
export type WorkflowDefinition = {
  name: string;
  description?: string;
  trigger: TriggerDefinition;
  steps: StepDefinition[];
  settings?: WorkflowSettings;
  topicId?: string;
  defaults?: {
    from?: string;
    fromName?: string;
    replyTo?: string;
    senderId?: string;
  };
};

/** Workflow settings */
export type WorkflowSettings = {
  allowReentry?: boolean;
  reentryDelaySeconds?: number;
  maxConcurrentExecutions?: number;
  contactCooldownSeconds?: number;
};

/** Flat step for DB storage */
export type WorkflowStep = {
  id: string;
  type: WorkflowStepType;
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

/** Transition between steps */
export type WorkflowTransition = {
  id: string;
  fromStepId: string;
  toStepId: string;
  condition?: {
    branch:
      | "yes"
      | "no"
      | "timeout"
      | "default"
      | "opened"
      | "clicked"
      | "bounced";
  };
};

/** Transformed workflow output */
export type TransformedWorkflow = {
  /** Flat array of steps with positions */
  steps: WorkflowStep[];
  /** Flat array of transitions between steps */
  transitions: WorkflowTransition[];
  /** Trigger type for the workflow */
  triggerType: WorkflowTriggerType;
  /** Trigger configuration */
  triggerConfig: TriggerConfig;
  /** Workflow settings */
  settings?: WorkflowSettings;
  /** Default sender settings */
  defaults?: {
    from?: string;
    fromName?: string;
    replyTo?: string;
    senderId?: string;
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORMER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transform a workflow definition from the user-friendly format (with nested branches)
 * to the flat format expected by the database.
 */
export function transformWorkflow(
  definition: WorkflowDefinition
): TransformedWorkflow {
  const steps: WorkflowStep[] = [];
  const transitions: WorkflowTransition[] = [];

  // 1. Create trigger step
  const triggerStep = createTriggerStep(definition.trigger);
  steps.push(triggerStep);

  // 2. Flatten nested steps, tracking parent-child relationships
  if (definition.steps.length > 0) {
    flattenSteps(definition.steps, steps, transitions, triggerStep.id, null);
  }

  // 3. Assign positions using auto-layout
  assignPositions(steps, transitions);

  return {
    steps,
    transitions,
    triggerType: definition.trigger.type,
    triggerConfig: extractTriggerConfig(definition.trigger),
    settings: definition.settings,
    defaults: definition.defaults,
  };
}

/**
 * Create the trigger step node.
 */
function createTriggerStep(trigger: TriggerDefinition): WorkflowStep {
  const triggerConfig: Record<string, unknown> = {
    type: "trigger",
    triggerType: trigger.type,
    ...extractTriggerConfig(trigger),
  };

  return {
    id: "trigger",
    type: "trigger",
    name: getTriggerName(trigger.type),
    position: { x: 0, y: 0 }, // Will be updated by assignPositions
    config: triggerConfig,
  };
}

/**
 * Extract trigger config fields (excluding type).
 */
function extractTriggerConfig(trigger: TriggerDefinition): TriggerConfig {
  const config: TriggerConfig = {};

  if (trigger.eventName) {
    config.eventName = trigger.eventName;
  }
  if (trigger.segmentId) {
    config.segmentId = trigger.segmentId;
  }
  if (trigger.schedule) {
    config.schedule = trigger.schedule;
  }
  if (trigger.timezone) {
    config.timezone = trigger.timezone;
  }
  if (trigger.topicId) {
    config.topicId = trigger.topicId;
  }

  return config;
}

/**
 * Get human-readable name for a trigger type.
 */
function getTriggerName(type: WorkflowTriggerType): string {
  const names: Record<WorkflowTriggerType, string> = {
    event: "When event occurs",
    contact_created: "When contact is created",
    contact_updated: "When contact is updated",
    segment_entry: "When contact enters segment",
    segment_exit: "When contact exits segment",
    schedule: "On schedule",
    api: "When triggered via API",
    topic_subscribed: "When contact subscribes to topic",
    topic_unsubscribed: "When contact unsubscribes from topic",
  };
  return names[type] || "Trigger";
}

/**
 * Recursively flatten nested steps into flat arrays.
 *
 * @param stepDefs - Array of step definitions to process
 * @param steps - Accumulator for flat steps
 * @param transitions - Accumulator for transitions
 * @param fromStepId - ID of the previous step to connect from
 * @param branch - Branch condition if inside a conditional branch
 * @returns ID of the last step in this sequence (for connecting subsequent steps)
 */
function flattenSteps(
  stepDefs: StepDefinition[],
  steps: WorkflowStep[],
  transitions: WorkflowTransition[],
  fromStepId: string,
  branch: "yes" | "no" | null
): string | null {
  let prevId = fromStepId;
  let firstStepInBranch = true;

  for (const def of stepDefs) {
    const step = toWorkflowStep(def);
    steps.push(step);

    // Create transition from previous step to this one
    const transition: WorkflowTransition = {
      id: `t-${prevId}-${step.id}`,
      fromStepId: prevId,
      toStepId: step.id,
    };

    // If this is the first step in a branch, add the branch condition
    if (firstStepInBranch && branch) {
      transition.condition = { branch };
    }

    transitions.push(transition);
    firstStepInBranch = false;

    // Handle conditional branches
    if (def.type === "condition" && def.branches) {
      // Process "yes" branch
      if (def.branches.yes && def.branches.yes.length > 0) {
        flattenSteps(def.branches.yes, steps, transitions, step.id, "yes");
      }

      // Process "no" branch
      if (def.branches.no && def.branches.no.length > 0) {
        flattenSteps(def.branches.no, steps, transitions, step.id, "no");
      }

      // After a condition with branches, we don't have a single "next" step
      // The branches diverge and may or may not converge later
      // For now, we don't auto-converge branches
      // Return null to indicate the flow has branched
      return null;
    }

    prevId = step.id;
  }

  return prevId;
}

/**
 * Convert a step definition to a WorkflowStep with DB-compatible config.
 */
function toWorkflowStep(def: StepDefinition): WorkflowStep {
  return {
    id: def.id,
    type: def.type as WorkflowStepType,
    name: def.name || getDefaultStepName(def.type),
    position: { x: 0, y: 0 }, // Will be updated by assignPositions
    config: def.config,
  };
}

/**
 * Get default name for a step type.
 */
function getDefaultStepName(type: string): string {
  const names: Record<string, string> = {
    send_email: "Send Email",
    send_sms: "Send SMS",
    delay: "Wait",
    exit: "Exit",
    condition: "Condition",
    webhook: "Webhook",
    update_contact: "Update Contact",
    wait_for_event: "Wait for Event",
    wait_for_email_engagement: "Wait for Email Engagement",
    subscribe_topic: "Subscribe to Topic",
    unsubscribe_topic: "Unsubscribe from Topic",
  };
  return names[type] || type;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assign positions to all steps using a simple auto-layout algorithm.
 *
 * Layout rules:
 * - Trigger at top center (x=0, y=0)
 * - Each depth level moves down by LEVEL_HEIGHT
 * - "yes" branches go left, "no" branches go right
 * - Single path stays centered (x=0)
 */
function assignPositions(
  steps: WorkflowStep[],
  transitions: WorkflowTransition[]
): void {
  const LEVEL_HEIGHT = 200;
  const BRANCH_OFFSET = 300;

  // Build adjacency map for BFS
  const childrenMap = new Map<string, Array<{ id: string; branch?: string }>>();
  for (const t of transitions) {
    if (!childrenMap.has(t.fromStepId)) {
      childrenMap.set(t.fromStepId, []);
    }
    childrenMap.get(t.fromStepId)?.push({
      id: t.toStepId,
      branch: t.condition?.branch,
    });
  }

  // BFS to assign levels and x offsets
  const visited = new Set<string>();
  const queue: Array<{
    stepId: string;
    level: number;
    xOffset: number;
  }> = [];

  // Start from trigger
  const triggerStep = steps.find((s) => s.type === "trigger");
  if (triggerStep) {
    queue.push({ stepId: triggerStep.id, level: 0, xOffset: 0 });
  }

  while (queue.length > 0) {
    const { stepId, level, xOffset } = queue.shift()!;

    if (visited.has(stepId)) {
      continue;
    }
    visited.add(stepId);

    // Find and update the step
    const step = steps.find((s) => s.id === stepId);
    if (step) {
      step.position = {
        x: xOffset,
        y: level * LEVEL_HEIGHT,
      };
    }

    // Queue children
    const children = childrenMap.get(stepId) || [];
    for (const child of children) {
      if (!visited.has(child.id)) {
        let childXOffset = xOffset;

        // Apply branch offset
        if (child.branch === "yes") {
          childXOffset = xOffset - BRANCH_OFFSET;
        } else if (child.branch === "no") {
          childXOffset = xOffset + BRANCH_OFFSET;
        }

        queue.push({
          stepId: child.id,
          level: level + 1,
          xOffset: childXOffset,
        });
      }
    }
  }

  // Handle any unvisited steps (disconnected from trigger)
  for (const step of steps) {
    if (!visited.has(step.id)) {
      // Place disconnected steps to the right
      step.position = {
        x: 600,
        y: steps.indexOf(step) * LEVEL_HEIGHT,
      };
    }
  }
}
