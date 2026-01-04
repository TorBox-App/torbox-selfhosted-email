import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { awsAccount } from "./app";
import { organization, user } from "./auth";
import { contact } from "./contacts";
import { template } from "./templates";
import { topic } from "./contacts";

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
  | "api";

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
};

/**
 * Configuration for each step type
 */
export type WorkflowStepConfig =
  | { type: "trigger"; triggerType: WorkflowTriggerType } & TriggerConfig
  | { type: "send_email"; templateId: string; from?: string; fromName?: string; replyTo?: string; subject?: string }
  | { type: "send_sms"; templateId?: string; body?: string; senderId?: string }
  | { type: "delay"; amount: number; unit: "minutes" | "hours" | "days" | "weeks" }
  | { type: "exit"; reason?: string; markAs?: "completed" | "cancelled" | "failed" }
  // Slice 2+
  | { type: "condition"; field: string; operator: string; value: unknown }
  | { type: "webhook"; url: string; method: string; headers?: Record<string, string>; body?: Record<string, unknown> }
  | { type: "update_contact"; updates: Array<{ field: string; operation: string; value?: unknown }> }
  | { type: "wait_for_event"; eventName: string; timeoutSeconds?: number }
  | { type: "subscribe_topic"; topicId: string; channel: "email" | "sms" }
  | { type: "unsubscribe_topic"; topicId: string; channel: "email" | "sms" };

/**
 * A step in the workflow (node on the canvas)
 */
export type WorkflowStep = {
  id: string;
  type: WorkflowStepType;
  name: string;
  position: { x: number; y: number };
  config: WorkflowStepConfig;
};

/**
 * A transition between steps (edge on the canvas)
 */
export type WorkflowTransition = {
  id: string;
  fromStepId: string;
  toStepId: string;
  condition?: {
    branch: "yes" | "no" | "timeout" | "default";
  };
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

    awsAccountId: text("aws_account_id")
      .references(() => awsAccount.id, { onDelete: "set null" }),

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
    transitions: jsonb("transitions")
      .$type<WorkflowTransition[]>()
      .default([]),

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

    // ═══════════════════════════════════════════════════════════════════════
    // EXECUTION STATE
    // ═══════════════════════════════════════════════════════════════════════
    status: workflowExecutionStatusEnum("status").default("pending").notNull(),
    currentStepId: text("current_step_id"),

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
    waitingForConditions: jsonb("waiting_for_conditions").$type<Record<string, unknown>>(),
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
