import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { awsAccount } from "./app";
import { organization, user } from "./auth";
import { contact, topic } from "./contacts";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Magic field name for cascade engagement conditions */
export const CASCADE_ENGAGEMENT_FIELD = "engagement.status" as const;

/**
 * Maximum number of times a failed execution may be retried. Once
 * `workflowExecution.retryCount` reaches this, the retry route rejects further
 * attempts and the dashboard stops offering the Retry button — a permanently
 * broken execution shouldn't loop forever.
 */
export const MAX_WORKFLOW_RETRIES = 5;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (for JSONB columns)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Workflow step types available in the builder
 * Slice 1: trigger, send_email, send_sms, delay, exit
 * Slice 2: condition, webhook, update_contact
 * Slice 3: wait_for_event, subscribe_topic, unsubscribe_topic
 */
export type WorkflowStepType =
  | "trigger"
  | "send_email"
  | "send_sms"
  | "delay"
  | "exit"
  // Slice 2
  | "condition"
  | "webhook"
  | "update_contact"
  // Slice 3
  | "wait_for_event"
  | "wait_for_email_engagement"
  | "subscribe_topic"
  | "unsubscribe_topic";

/**
 * Trigger types for workflow entry points
 * Slice 1: event only
 * Slice 3: segment_entry, segment_exit, schedule, api
 */
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

/**
 * Trigger configuration based on trigger type
 */
export type TriggerConfig = {
  // For event trigger
  eventName?: string;

  // For segment triggers (Slice 3)
  segmentId?: string;

  // For schedule trigger (Slice 3)
  schedule?: string; // Cron expression
  timezone?: string;

  // For topic triggers
  topicId?: string;
};

/**
 * Configuration for each step type
 */
export type WorkflowStepConfig =
  | ({ type: "trigger"; triggerType: WorkflowTriggerType } & TriggerConfig)
  | {
      type: "send_email";
      templateId: string;
      from?: string;
      fromName?: string;
      replyTo?: string;
      subject?: string;
    }
  | { type: "send_sms"; templateId?: string; body?: string; senderId?: string }
  | {
      type: "delay";
      amount: number;
      unit: "minutes" | "hours" | "days" | "weeks";
    }
  | {
      type: "exit";
      reason?: string;
      markAs?: "completed" | "cancelled" | "failed";
    }
  // Slice 2+
  | { type: "condition"; field: string; operator: string; value: unknown }
  | {
      type: "webhook";
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
    }
  | {
      type: "update_contact";
      updates: Array<{ field: string; operation: string; value?: unknown }>;
    }
  | { type: "wait_for_event"; eventName: string; timeoutSeconds?: number }
  | { type: "wait_for_email_engagement"; timeoutSeconds?: number }
  | { type: "subscribe_topic"; topicId: string; channel: "email" | "sms" }
  | { type: "unsubscribe_topic"; topicId: string; channel: "email" | "sms" };

/**
 * A channel in a cascade sequence (mirrors the code API's CascadeChannel)
 */
export type CascadeChannelConfig = {
  /** Stable ID for React key when reordering */
  id?: string;
  type: "email" | "sms";
  templateId?: string;
  body?: string;
  engagement?: "opened" | "clicked";
  waitDuration?: number; // seconds to wait for engagement
};

/**
 * A step in the workflow (node on the canvas)
 */
export type WorkflowStep = {
  id: string;
  type: WorkflowStepType;
  name: string;
  position: { x: number; y: number };
  config: WorkflowStepConfig;
  /** If this step belongs to a cascade group, the group's ID */
  cascadeGroupId?: string;
  /** Cascade reconstruction metadata - only set on first step of cascade group */
  cascadeChannels?: CascadeChannelConfig[];
};

/**
 * A transition between steps (edge on the canvas)
 */
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

/**
 * Snapshot of workflow definition at execution creation time.
 * Ensures in-flight executions are not corrupted by subsequent edits.
 */
export type WorkflowDefinitionSnapshot = {
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
  workflowVersion: number;
};

/**
 * Canvas viewport for React Flow
 */
export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Workflow status
 */
export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "enabled",
  "paused",
  "archived",
]);

/**
 * Workflow execution status
 */
export const workflowExecutionStatusEnum = pgEnum("workflow_execution_status", [
  "pending",
  "active",
  "paused", // Waiting for delay
  "waiting", // Waiting for event (Slice 3)
  "completed",
  "failed",
  "cancelled",
]);

/**
 * Step execution status
 */
export const workflowStepExecutionStatusEnum = pgEnum(
  "workflow_step_execution_status",
  ["pending", "executing", "completed", "failed", "skipped"]
);

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Workflow
 *
 * Defines an automation workflow with trigger, steps, and transitions.
 * The workflow definition (steps/transitions) is stored as JSONB for flexibility.
 */
export const workflow = pgTable(
  "workflow",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    awsAccountId: text("aws_account_id").references(() => awsAccount.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    description: text("description"),

    // Optional: associate workflow with a topic for subscription checks
    topicId: text("topic_id").references(() => topic.id, {
      onDelete: "set null",
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // CANVAS STATE
    // ═══════════════════════════════════════════════════════════════════════
    canvasViewport: jsonb("canvas_viewport")
      .$type<CanvasViewport>()
      .default({ x: 0, y: 0, zoom: 1 }),

    // ═══════════════════════════════════════════════════════════════════════
    // STATUS
    // ═══════════════════════════════════════════════════════════════════════
    status: workflowStatusEnum("status").default("draft").notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // TRIGGER CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════
    triggerType: text("trigger_type").$type<WorkflowTriggerType>(),
    triggerConfig: jsonb("trigger_config").$type<TriggerConfig>().default({}),

    // ═══════════════════════════════════════════════════════════════════════
    // WORKFLOW DEFINITION
    // ═══════════════════════════════════════════════════════════════════════
    steps: jsonb("steps").$type<WorkflowStep[]>().default([]),
    transitions: jsonb("transitions").$type<WorkflowTransition[]>().default([]),

    /** Monotonically increasing version counter, bumped on every definition edit */
    version: integer("version").default(1).notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // EXECUTION SETTINGS
    // ═══════════════════════════════════════════════════════════════════════
    allowReentry: boolean("allow_reentry").default(false).notNull(),
    reentryDelaySeconds: integer("reentry_delay_seconds"),
    maxConcurrentExecutions: integer("max_concurrent_executions").default(1000),
    contactCooldownSeconds: integer("contact_cooldown_seconds"),

    // ═══════════════════════════════════════════════════════════════════════
    // STATS (denormalized for performance)
    // ═══════════════════════════════════════════════════════════════════════
    totalExecutions: integer("total_executions").default(0).notNull(),
    activeExecutions: integer("active_executions").default(0).notNull(),
    completedExecutions: integer("completed_executions").default(0).notNull(),
    failedExecutions: integer("failed_executions").default(0).notNull(),
    droppedExecutions: integer("dropped_executions").default(0).notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // AI METADATA
    // ═══════════════════════════════════════════════════════════════════════
    aiGenerated: boolean("ai_generated").default(false),
    aiPrompt: text("ai_prompt"),

    // ═══════════════════════════════════════════════════════════════════════
    // CLI SYNC (workflows-as-code)
    // ═══════════════════════════════════════════════════════════════════════
    /** Kebab-case identifier derived from filename (e.g., "onboarding" from onboarding.ts) */
    slug: text("slug"),
    /** Original TypeScript source code */
    sourceTs: text("source_ts"),
    /** SHA256 hash of source for change detection */
    sourceHash: text("source_hash"),
    /** Whether this workflow was pushed from CLI */
    pushedFromCli: boolean("pushed_from_cli").default(false),
    /** When the workflow was last pushed from CLI */
    lastPushedAt: timestamp("last_pushed_at"),
    /** Path to the workflow file in the project (e.g., "workflows/onboarding.ts") */
    cliProjectPath: text("cli_project_path"),
    /** Where the workflow was last edited: "cli" | "dashboard" | null */
    lastEditedFrom: text("last_edited_from").$type<
      "cli" | "dashboard" | null
    >(),

    // ═══════════════════════════════════════════════════════════════════════
    // SENDER DEFAULTS (step config can override these)
    // ═══════════════════════════════════════════════════════════════════════
    defaultFrom: text("default_from"), // e.g., "hello@example.com"
    defaultFromName: text("default_from_name"), // e.g., "Acme Inc"
    defaultReplyTo: text("default_reply_to"), // e.g., "support@example.com"
    defaultSenderId: text("default_sender_id"), // SMS: phone number or alphanumeric ID

    // ═══════════════════════════════════════════════════════════════════════
    // TIMESTAMPS
    // ═══════════════════════════════════════════════════════════════════════
    lastTriggeredAt: timestamp("last_triggered_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflow_org_idx").on(table.organizationId),
    index("workflow_status_idx").on(table.organizationId, table.status),
    index("workflow_trigger_type_idx").on(
      table.organizationId,
      table.triggerType
    ),
    index("workflow_aws_account_idx").on(table.awsAccountId),
    // Unique slug per organization (for CLI sync)
    uniqueIndex("workflow_org_slug_idx").on(table.organizationId, table.slug),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW EXECUTION TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Workflow Execution
 *
 * Tracks a single execution of a workflow for a contact.
 * Each time a workflow is triggered for a contact, a new execution is created.
 */
export const workflowExecution = pgTable(
  "workflow_execution",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    workflowId: text("workflow_id")
      .references(() => workflow.id, { onDelete: "cascade" })
      .notNull(),

    contactId: text("contact_id")
      .references(() => contact.id, { onDelete: "cascade" })
      .notNull(),

    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    // Denormalized from workflow for partial unique index constraint
    // This enables atomic INSERT with ON CONFLICT to prevent race conditions
    allowReentry: boolean("allow_reentry").default(false).notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // EXECUTION STATE
    // ═══════════════════════════════════════════════════════════════════════
    status: workflowExecutionStatusEnum("status").default("pending").notNull(),
    currentStepId: text("current_step_id"),

    /** Frozen copy of workflow steps + transitions at execution creation time */
    definitionSnapshot: jsonb(
      "definition_snapshot"
    ).$type<WorkflowDefinitionSnapshot>(),

    // Context data (persisted between steps)
    context: jsonb("context").$type<Record<string, unknown>>().default({}),

    // ═══════════════════════════════════════════════════════════════════════
    // TRIGGER INFO
    // ═══════════════════════════════════════════════════════════════════════
    triggerEventId: text("trigger_event_id"),
    triggerData: jsonb("trigger_data").$type<Record<string, unknown>>(),

    // ═══════════════════════════════════════════════════════════════════════
    // WAIT-FOR-EVENT TRACKING (Slice 3)
    // ═══════════════════════════════════════════════════════════════════════
    waitingForEvent: text("waiting_for_event"),
    waitingForConditions: jsonb("waiting_for_conditions").$type<
      Record<string, unknown>
    >(),
    waitTimeoutAt: timestamp("wait_timeout_at"),
    waitTimeoutSchedulerName: text("wait_timeout_scheduler_name"),

    // ═══════════════════════════════════════════════════════════════════════
    // DELAY SCHEDULING
    // ═══════════════════════════════════════════════════════════════════════
    nextStepScheduledAt: timestamp("next_step_scheduled_at"),
    delaySchedulerName: text("delay_scheduler_name"),

    // ═══════════════════════════════════════════════════════════════════════
    // ERROR TRACKING
    // ═══════════════════════════════════════════════════════════════════════
    error: text("error"),
    errorStepId: text("error_step_id"),
    retryCount: integer("retry_count").default(0),

    // ═══════════════════════════════════════════════════════════════════════
    // TIMESTAMPS
    // ═══════════════════════════════════════════════════════════════════════
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflow_execution_workflow_idx").on(table.workflowId),
    index("workflow_execution_contact_idx").on(table.contactId),
    index("workflow_execution_org_idx").on(table.organizationId),
    index("workflow_execution_status_idx").on(table.workflowId, table.status),
    index("workflow_execution_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    index("workflow_execution_scheduled_idx").on(table.nextStepScheduledAt),
    // Critical index for wait-for-event matching (Slice 3)
    index("workflow_execution_waiting_event_idx").on(
      table.organizationId,
      table.waitingForEvent
    ),
    // Partial unique index for atomic reentry prevention
    // Prevents duplicate active executions when allowReentry=false
    uniqueIndex("workflow_execution_no_reentry_idx")
      .on(table.workflowId, table.contactId)
      .where(
        sql`${table.status} IN ('pending', 'active', 'paused', 'waiting') AND ${table.allowReentry} = false`
      ),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW STEP EXECUTION TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Workflow Step Execution
 *
 * Tracks the execution of each step within a workflow execution.
 * Used for idempotency (prevent duplicate sends on retry) and audit trail.
 */
export const workflowStepExecution = pgTable(
  "workflow_step_execution",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    executionId: text("execution_id")
      .references(() => workflowExecution.id, { onDelete: "cascade" })
      .notNull(),

    stepId: text("step_id").notNull(),
    stepType: text("step_type").$type<WorkflowStepType>().notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // STATUS
    // ═══════════════════════════════════════════════════════════════════════
    status: workflowStepExecutionStatusEnum("status")
      .default("pending")
      .notNull(),

    // Idempotency key for retries (e.g., "exec_123-step_456")
    idempotencyKey: text("idempotency_key").notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // RESULTS
    // ═══════════════════════════════════════════════════════════════════════
    branch: text("branch"), // yes, no, timeout, default
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    skipReason: text("skip_reason"), // e.g., "contact_unsubscribed"

    // ═══════════════════════════════════════════════════════════════════════
    // TIMESTAMPS
    // ═══════════════════════════════════════════════════════════════════════
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflow_step_execution_execution_idx").on(table.executionId),
    uniqueIndex("workflow_step_execution_idempotency_idx").on(
      table.idempotencyKey
    ),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const workflowRelations = relations(workflow, ({ one, many }) => ({
  organization: one(organization, {
    fields: [workflow.organizationId],
    references: [organization.id],
  }),
  awsAccount: one(awsAccount, {
    fields: [workflow.awsAccountId],
    references: [awsAccount.id],
  }),
  topic: one(topic, {
    fields: [workflow.topicId],
    references: [topic.id],
  }),
  createdByUser: one(user, {
    fields: [workflow.createdBy],
    references: [user.id],
  }),
  executions: many(workflowExecution),
}));

export const workflowExecutionRelations = relations(
  workflowExecution,
  ({ one, many }) => ({
    workflow: one(workflow, {
      fields: [workflowExecution.workflowId],
      references: [workflow.id],
    }),
    contact: one(contact, {
      fields: [workflowExecution.contactId],
      references: [contact.id],
    }),
    organization: one(organization, {
      fields: [workflowExecution.organizationId],
      references: [organization.id],
    }),
    stepExecutions: many(workflowStepExecution),
  })
);

export const workflowStepExecutionRelations = relations(
  workflowStepExecution,
  ({ one }) => ({
    execution: one(workflowExecution, {
      fields: [workflowStepExecution.executionId],
      references: [workflowExecution.id],
    }),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type Workflow = typeof workflow.$inferSelect;
export type NewWorkflow = typeof workflow.$inferInsert;
export type WorkflowStatus = Workflow["status"];

export type WorkflowExecution = typeof workflowExecution.$inferSelect;
export type NewWorkflowExecution = typeof workflowExecution.$inferInsert;
export type WorkflowExecutionStatus = WorkflowExecution["status"];

export type WorkflowStepExecutionRecord =
  typeof workflowStepExecution.$inferSelect;
export type NewWorkflowStepExecution =
  typeof workflowStepExecution.$inferInsert;
export type WorkflowStepExecutionStatus = WorkflowStepExecutionRecord["status"];
