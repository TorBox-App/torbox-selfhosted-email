/**
 * Workflow Processor Worker
 *
 * SQS Lambda handler that processes workflow step executions.
 * Handles different step types and routes to next steps.
 */

import type { SQSEvent, SQSHandler } from "aws-lambda";
import {
  contact,
  contactTopic,
  db,
  eq,
  workflow,
  workflowExecution,
  workflowStepExecution,
  type WorkflowStep,
  type WorkflowStepConfig,
  type WorkflowTransition,
} from "@wraps/db";
import { and, sql } from "drizzle-orm";

import {
  deleteScheduledStep,
  enqueueWorkflowStep,
  scheduleWaitTimeout,
  scheduleWorkflowStep,
  type WorkflowJob,
} from "../services/workflow-queue";

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const job: WorkflowJob = JSON.parse(record.body);

    try {
      switch (job.type) {
        case "execute":
          await processStep(job.executionId, job.stepId);
          break;
        case "resume":
          await resumeExecution(job.executionId, job.branch);
          break;
        case "trigger":
          await triggerWorkflow(job.workflowId, job.contactId, job.organizationId, job.eventData);
          break;
      }
    } catch (error) {
      console.error(`Error processing workflow job:`, error);
      throw error; // Re-throw to let SQS retry
    }
  }
};

/**
 * Trigger a new workflow execution for a contact
 */
async function triggerWorkflow(
  workflowId: string,
  contactId: string,
  organizationId: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  // Load workflow
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1);

  if (!wf || wf.status !== "enabled") {
    console.log(`Workflow ${workflowId} not found or not enabled`);
    return;
  }

  // Check for existing active execution (if reentry not allowed)
  if (!wf.allowReentry) {
    const existing = await db.query.workflowExecution.findFirst({
      where: and(
        eq(workflowExecution.workflowId, workflowId),
        eq(workflowExecution.contactId, contactId),
        sql`${workflowExecution.status} IN ('pending', 'active', 'paused', 'waiting')`
      ),
    });

    if (existing) {
      console.log(`Skipping - contact ${contactId} already in workflow ${workflowId}`);
      return;
    }
  }

  // Find the trigger step to get the first connected step
  const steps = wf.steps as WorkflowStep[];
  const transitions = wf.transitions as WorkflowTransition[];

  const triggerStep = steps.find(s => s.type === "trigger");
  if (!triggerStep) {
    console.error(`No trigger step found in workflow ${workflowId}`);
    return;
  }

  // Find the first step after trigger
  const firstTransition = transitions.find(t => t.fromStepId === triggerStep.id);
  const firstStepId = firstTransition?.toStepId;

  if (!firstStepId) {
    console.log(`No steps after trigger in workflow ${workflowId}`);
    return;
  }

  // Create execution record
  const [execution] = await db
    .insert(workflowExecution)
    .values({
      workflowId,
      contactId,
      organizationId,
      status: "active",
      currentStepId: firstStepId,
      triggerData: eventData ?? {},
      startedAt: new Date(),
    })
    .returning();

  // Update workflow stats
  await db
    .update(workflow)
    .set({
      totalExecutions: sql`${workflow.totalExecutions} + 1`,
      activeExecutions: sql`${workflow.activeExecutions} + 1`,
      lastTriggeredAt: new Date(),
    })
    .where(eq(workflow.id, workflowId));

  // Process first step
  await enqueueWorkflowStep({
    type: "execute",
    executionId: execution.id,
    stepId: firstStepId,
    organizationId,
  });
}

/**
 * Process a single workflow step
 */
async function processStep(executionId: string, stepId: string): Promise<void> {
  // Load execution with workflow and contact
  const execution = await db.query.workflowExecution.findFirst({
    where: eq(workflowExecution.id, executionId),
  });

  if (!execution) {
    console.error(`Execution ${executionId} not found`);
    return;
  }

  if (execution.status === "cancelled" || execution.status === "completed") {
    console.log(`Execution ${executionId} already ${execution.status}`);
    return;
  }

  // Load workflow
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  if (!wf) {
    console.error(`Workflow ${execution.workflowId} not found`);
    return;
  }

  // Load contact
  const [contactRecord] = await db
    .select()
    .from(contact)
    .where(eq(contact.id, execution.contactId))
    .limit(1);

  if (!contactRecord) {
    console.error(`Contact ${execution.contactId} not found`);
    await failExecution(executionId, "Contact not found", stepId);
    return;
  }

  const steps = wf.steps as WorkflowStep[];
  const step = steps.find(s => s.id === stepId);

  if (!step) {
    console.error(`Step ${stepId} not found in workflow`);
    await failExecution(executionId, `Step ${stepId} not found`, stepId);
    return;
  }

  // Check idempotency - was this step already executed?
  const idempotencyKey = `${executionId}-${stepId}`;
  const existingStepExec = await db.query.workflowStepExecution.findFirst({
    where: eq(workflowStepExecution.idempotencyKey, idempotencyKey),
  });

  if (existingStepExec && existingStepExec.status === "completed") {
    console.log(`Step ${stepId} already executed for ${executionId}`);
    return;
  }

  // Create or update step execution record
  const [stepExec] = existingStepExec
    ? await db
        .update(workflowStepExecution)
        .set({ status: "executing", startedAt: new Date() })
        .where(eq(workflowStepExecution.id, existingStepExec.id))
        .returning()
    : await db
        .insert(workflowStepExecution)
        .values({
          executionId,
          stepId,
          stepType: step.type,
          status: "executing",
          idempotencyKey,
          startedAt: new Date(),
        })
        .returning();

  // Update execution current step
  await db
    .update(workflowExecution)
    .set({ currentStepId: stepId, status: "active", updatedAt: new Date() })
    .where(eq(workflowExecution.id, executionId));

  // Execute step based on type
  try {
    const result = await executeStep(
      step,
      execution,
      contactRecord,
      wf.organizationId
    );

    // Mark step as completed
    await db
      .update(workflowStepExecution)
      .set({
        status: "completed",
        branch: result.branch,
        result: result.data,
        completedAt: new Date(),
      })
      .where(eq(workflowStepExecution.id, stepExec.id));

    // Handle step result
    if (result.action === "next") {
      await processNextStep(execution, step, wf, result.branch);
    } else if (result.action === "wait") {
      // Step is waiting (e.g., delay scheduled, waiting for event)
      // Execution status already updated by the step handler
    } else if (result.action === "exit") {
      await completeExecution(executionId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Step ${stepId} failed:`, error);

    await db
      .update(workflowStepExecution)
      .set({
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(workflowStepExecution.id, stepExec.id));

    await failExecution(executionId, errorMessage, stepId);
  }
}

/**
 * Execute a single step and return the result
 */
type WorkflowBranch = "yes" | "no" | "timeout" | "default" | "opened" | "clicked" | "bounced";

async function executeStep(
  step: WorkflowStep,
  execution: typeof workflowExecution.$inferSelect,
  contactRecord: typeof contact.$inferSelect,
  organizationId: string
): Promise<{
  action: "next" | "wait" | "exit";
  branch?: WorkflowBranch;
  data?: Record<string, unknown>;
}> {
  const config = step.config;

  switch (config.type) {
    case "trigger":
      // Trigger is just an entry point, proceed to next
      return { action: "next" };

    case "send_email":
      return await handleSendEmail(config, execution, contactRecord, organizationId);

    case "send_sms":
      return await handleSendSms(config, execution, contactRecord, organizationId);

    case "delay":
      return await handleDelay(config, execution, step.id, organizationId);

    case "condition":
      return handleCondition(config, contactRecord, execution);

    case "update_contact":
      return await handleUpdateContact(config, contactRecord);

    case "webhook":
      return await handleWebhook(config, contactRecord, execution);

    case "wait_for_event":
      return await handleWaitForEvent(config, execution, step.id, organizationId);

    case "wait_for_email_engagement":
      return await handleWaitForEmailEngagement(config, execution, step.id, organizationId);

    case "subscribe_topic":
      return await handleSubscribeTopic(config, contactRecord);

    case "unsubscribe_topic":
      return await handleUnsubscribeTopic(config, contactRecord);

    case "exit":
      return { action: "exit" };

    default:
      throw new Error(`Unknown step type: ${(config as { type: string }).type}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleSendEmail(
  config: Extract<WorkflowStepConfig, { type: "send_email" }>,
  execution: typeof workflowExecution.$inferSelect,
  contactRecord: typeof contact.$inferSelect,
  _organizationId: string
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // TODO: Implement email sending via customer's SES
  // For now, log and proceed
  console.log(`[workflow] Would send email template ${config.templateId} to ${contactRecord.email}`);

  return {
    action: "next",
    data: {
      templateId: config.templateId,
      recipient: contactRecord.email,
      timestamp: new Date().toISOString(),
    },
  };
}

async function handleSendSms(
  config: Extract<WorkflowStepConfig, { type: "send_sms" }>,
  _execution: typeof workflowExecution.$inferSelect,
  contactRecord: typeof contact.$inferSelect,
  _organizationId: string
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // TODO: Implement SMS sending
  console.log(`[workflow] Would send SMS to contact ${contactRecord.id}`);

  return {
    action: "next",
    data: {
      body: config.body,
      timestamp: new Date().toISOString(),
    },
  };
}

async function handleDelay(
  config: Extract<WorkflowStepConfig, { type: "delay" }>,
  execution: typeof workflowExecution.$inferSelect,
  stepId: string,
  organizationId: string
): Promise<{ action: "wait" }> {
  // Calculate delay in seconds
  let delaySeconds = config.amount;
  switch (config.unit) {
    case "minutes":
      delaySeconds *= 60;
      break;
    case "hours":
      delaySeconds *= 3600;
      break;
    case "days":
      delaySeconds *= 86400;
      break;
    case "weeks":
      delaySeconds *= 604800;
      break;
  }

  // Find the next step after delay
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  const transitions = wf?.transitions as WorkflowTransition[] | undefined;
  const nextTransition = transitions?.find(t => t.fromStepId === stepId);

  if (!nextTransition) {
    // No next step - complete execution
    await completeExecution(execution.id);
    return { action: "wait" };
  }

  // Schedule the next step
  const schedulerName = await scheduleWorkflowStep({
    executionId: execution.id,
    stepId: nextTransition.toStepId,
    organizationId,
    delaySeconds,
  });

  // Update execution status
  await db
    .update(workflowExecution)
    .set({
      status: "paused",
      nextStepScheduledAt: new Date(Date.now() + delaySeconds * 1000),
      delaySchedulerName: schedulerName,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, execution.id));

  return { action: "wait" };
}

function handleCondition(
  config: Extract<WorkflowStepConfig, { type: "condition" }>,
  contactRecord: typeof contact.$inferSelect,
  execution: typeof workflowExecution.$inferSelect
): { action: "next"; branch: "yes" | "no" } {
  // Get the field value from contact properties
  const properties = contactRecord.properties as Record<string, unknown> | null;
  const triggerData = execution.triggerData as Record<string, unknown> | null;

  // Try contact fields first, then contact.properties, then trigger data
  let fieldValue: unknown;
  if (config.field in contactRecord) {
    fieldValue = contactRecord[config.field as keyof typeof contactRecord];
  } else if (properties && config.field in properties) {
    fieldValue = properties[config.field];
  } else if (triggerData && config.field in triggerData) {
    fieldValue = triggerData[config.field];
  }

  // Evaluate condition
  const conditionMet = evaluateCondition(fieldValue, config.operator, config.value);

  return {
    action: "next",
    branch: conditionMet ? "yes" : "no",
  };
}

function evaluateCondition(
  fieldValue: unknown,
  operator: string,
  compareValue: unknown
): boolean {
  const strFieldValue = String(fieldValue ?? "");
  const strCompareValue = String(compareValue ?? "");

  switch (operator) {
    case "equals":
      return strFieldValue === strCompareValue;
    case "not_equals":
      return strFieldValue !== strCompareValue;
    case "contains":
      return strFieldValue.includes(strCompareValue);
    case "not_contains":
      return !strFieldValue.includes(strCompareValue);
    case "starts_with":
      return strFieldValue.startsWith(strCompareValue);
    case "ends_with":
      return strFieldValue.endsWith(strCompareValue);
    case "greater_than":
      return Number(fieldValue) > Number(compareValue);
    case "less_than":
      return Number(fieldValue) < Number(compareValue);
    case "is_set":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
    case "is_not_set":
      return fieldValue === null || fieldValue === undefined || fieldValue === "";
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

async function handleUpdateContact(
  config: Extract<WorkflowStepConfig, { type: "update_contact" }>,
  contactRecord: typeof contact.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  const updates = config.updates || [];
  const currentProperties = (contactRecord.properties as Record<string, unknown>) || {};
  const newProperties = { ...currentProperties };

  for (const update of updates) {
    switch (update.operation) {
      case "set":
        newProperties[update.field] = update.value;
        break;
      case "unset":
        delete newProperties[update.field];
        break;
      case "increment":
        newProperties[update.field] = (Number(newProperties[update.field]) || 0) + Number(update.value);
        break;
      case "decrement":
        newProperties[update.field] = (Number(newProperties[update.field]) || 0) - Number(update.value);
        break;
      case "append":
        const arr = Array.isArray(newProperties[update.field]) ? newProperties[update.field] : [];
        (arr as unknown[]).push(update.value);
        newProperties[update.field] = arr;
        break;
      case "remove":
        if (Array.isArray(newProperties[update.field])) {
          newProperties[update.field] = (newProperties[update.field] as unknown[]).filter(
            v => v !== update.value
          );
        }
        break;
    }
  }

  await db
    .update(contact)
    .set({ properties: newProperties, updatedAt: new Date() })
    .where(eq(contact.id, contactRecord.id));

  return {
    action: "next",
    data: { updatedFields: updates.map(u => u.field) },
  };
}

async function handleWebhook(
  config: Extract<WorkflowStepConfig, { type: "webhook" }>,
  contactRecord: typeof contact.$inferSelect,
  execution: typeof workflowExecution.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  const body = {
    contact: {
      id: contactRecord.id,
      email: contactRecord.email,
      properties: contactRecord.properties,
    },
    execution: {
      id: execution.id,
      workflowId: execution.workflowId,
      triggerData: execution.triggerData,
    },
    ...(config.body || {}),
  };

  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        ...(config.headers || {}),
      },
      body: config.method !== "GET" ? JSON.stringify(body) : undefined,
    });

    return {
      action: "next",
      data: {
        status: response.status,
        ok: response.ok,
      },
    };
  } catch (error) {
    console.error(`Webhook failed:`, error);
    return {
      action: "next",
      data: {
        error: error instanceof Error ? error.message : "Webhook failed",
      },
    };
  }
}

async function handleWaitForEvent(
  config: Extract<WorkflowStepConfig, { type: "wait_for_event" }>,
  execution: typeof workflowExecution.$inferSelect,
  stepId: string,
  organizationId: string
): Promise<{ action: "wait" }> {
  const timeoutSeconds = config.timeoutSeconds || 86400; // Default 24 hours
  const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000);

  // Schedule timeout
  const schedulerName = await scheduleWaitTimeout({
    executionId: execution.id,
    stepId,
    organizationId,
    timeoutSeconds,
  });

  // Update execution to waiting state
  await db
    .update(workflowExecution)
    .set({
      status: "waiting",
      waitingForEvent: config.eventName,
      waitTimeoutAt: timeoutAt,
      waitTimeoutSchedulerName: schedulerName,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, execution.id));

  return { action: "wait" };
}

async function handleWaitForEmailEngagement(
  config: Extract<WorkflowStepConfig, { type: "wait_for_email_engagement" }>,
  execution: typeof workflowExecution.$inferSelect,
  stepId: string,
  organizationId: string
): Promise<{ action: "wait" }> {
  const timeoutSeconds = config.timeoutSeconds || 259200; // Default 3 days
  const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000);

  // Find the previous send_email step execution to get the message ID
  const previousStepExecs = await db
    .select()
    .from(workflowStepExecution)
    .where(
      and(
        eq(workflowStepExecution.executionId, execution.id),
        eq(workflowStepExecution.stepType, "send_email"),
        eq(workflowStepExecution.status, "completed")
      )
    )
    .orderBy(sql`${workflowStepExecution.completedAt} DESC`)
    .limit(1);

  const lastEmailStep = previousStepExecs[0];
  const messageId = lastEmailStep?.result
    ? (lastEmailStep.result as Record<string, unknown>).messageId
    : undefined;

  // Schedule timeout
  const schedulerName = await scheduleWaitTimeout({
    executionId: execution.id,
    stepId,
    organizationId,
    timeoutSeconds,
  });

  // Update execution to waiting state
  // We use 'email_engagement' as a special event name prefix
  await db
    .update(workflowExecution)
    .set({
      status: "waiting",
      waitingForEvent: `email_engagement:${messageId || "unknown"}`,
      waitTimeoutAt: timeoutAt,
      waitTimeoutSchedulerName: schedulerName,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, execution.id));

  return { action: "wait" };
}

async function handleSubscribeTopic(
  config: Extract<WorkflowStepConfig, { type: "subscribe_topic" }>,
  contactRecord: typeof contact.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // Upsert contact-topic subscription
  await db
    .insert(contactTopic)
    .values({
      contactId: contactRecord.id,
      topicId: config.topicId,
      status: "subscribed",
      subscribedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [contactTopic.contactId, contactTopic.topicId],
      set: {
        status: "subscribed",
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
    });

  return {
    action: "next",
    data: { topicId: config.topicId, channel: config.channel, action: "subscribed" },
  };
}

async function handleUnsubscribeTopic(
  config: Extract<WorkflowStepConfig, { type: "unsubscribe_topic" }>,
  contactRecord: typeof contact.$inferSelect
): Promise<{ action: "next"; data: Record<string, unknown> }> {
  // Update subscription to unsubscribe
  await db
    .update(contactTopic)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date(),
    })
    .where(
      and(
        eq(contactTopic.contactId, contactRecord.id),
        eq(contactTopic.topicId, config.topicId)
      )
    );

  return {
    action: "next",
    data: { topicId: config.topicId, channel: config.channel, action: "unsubscribed" },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION FLOW HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process the next step in the workflow
 */
async function processNextStep(
  execution: typeof workflowExecution.$inferSelect,
  currentStep: WorkflowStep,
  wf: typeof workflow.$inferSelect,
  branch?: WorkflowBranch
): Promise<void> {
  const transitions = wf.transitions as WorkflowTransition[];

  // Find matching transition
  let nextTransition: WorkflowTransition | undefined;

  if (branch) {
    // Look for transition with matching branch
    nextTransition = transitions.find(
      t => t.fromStepId === currentStep.id && t.condition?.branch === branch
    );
  }

  // Fallback to any transition from this step
  if (!nextTransition) {
    nextTransition = transitions.find(
      t => t.fromStepId === currentStep.id && !t.condition
    );
  }

  if (!nextTransition) {
    // No next step - complete execution
    await completeExecution(execution.id);
    return;
  }

  // Enqueue next step for processing
  await enqueueWorkflowStep({
    type: "execute",
    executionId: execution.id,
    stepId: nextTransition.toStepId,
    organizationId: wf.organizationId,
  });
}

/**
 * Resume a paused/waiting execution
 */
async function resumeExecution(
  executionId: string,
  branch: WorkflowBranch
): Promise<void> {
  const execution = await db.query.workflowExecution.findFirst({
    where: eq(workflowExecution.id, executionId),
  });

  if (!execution) {
    console.error(`Execution ${executionId} not found`);
    return;
  }

  if (execution.status !== "waiting") {
    console.log(`Execution ${executionId} not in waiting state (${execution.status})`);
    return;
  }

  // Load workflow
  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, execution.workflowId))
    .limit(1);

  if (!wf) {
    console.error(`Workflow ${execution.workflowId} not found`);
    return;
  }

  const steps = wf.steps as WorkflowStep[];
  const currentStep = steps.find(s => s.id === execution.currentStepId);

  if (!currentStep) {
    console.error(`Current step ${execution.currentStepId} not found`);
    return;
  }

  // Clear wait state
  await db
    .update(workflowExecution)
    .set({
      status: "active",
      waitingForEvent: null,
      waitTimeoutAt: null,
      waitTimeoutSchedulerName: null,
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, executionId));

  // If it was a timeout, try to cancel the timeout scheduler
  if (branch !== "timeout" && execution.waitTimeoutSchedulerName) {
    await deleteScheduledStep(execution.waitTimeoutSchedulerName);
  }

  // Record step completion with branch
  await db
    .update(workflowStepExecution)
    .set({
      status: "completed",
      branch,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(workflowStepExecution.executionId, executionId),
        eq(workflowStepExecution.stepId, currentStep.id)
      )
    );

  // Process next step based on branch
  await processNextStep(execution, currentStep, wf, branch);
}

/**
 * Mark execution as completed
 */
async function completeExecution(executionId: string): Promise<void> {
  const [execution] = await db
    .update(workflowExecution)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, executionId))
    .returning();

  if (execution) {
    await db
      .update(workflow)
      .set({
        activeExecutions: sql`GREATEST(0, ${workflow.activeExecutions} - 1)`,
        completedExecutions: sql`${workflow.completedExecutions} + 1`,
      })
      .where(eq(workflow.id, execution.workflowId));
  }
}

/**
 * Mark execution as failed
 */
async function failExecution(
  executionId: string,
  error: string,
  stepId: string
): Promise<void> {
  const [execution] = await db
    .update(workflowExecution)
    .set({
      status: "failed",
      error,
      errorStepId: stepId,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowExecution.id, executionId))
    .returning();

  if (execution) {
    await db
      .update(workflow)
      .set({
        activeExecutions: sql`GREATEST(0, ${workflow.activeExecutions} - 1)`,
        failedExecutions: sql`${workflow.failedExecutions} + 1`,
      })
      .where(eq(workflow.id, execution.workflowId));
  }
}
