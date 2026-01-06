/**
 * Workflow Events Service
 *
 * Handles emitting internal events to trigger workflows.
 * Used for contact lifecycle events, topic subscriptions, etc.
 */

import {
  contactEvent,
  db,
  eq,
  segment,
  workflow,
  workflowExecution,
} from "@wraps/db";
import { and, inArray, sql } from "drizzle-orm";

import { contactMatchesSegment } from "./segment-evaluator";
import { deleteScheduledStep, enqueueWorkflowStep } from "./workflow-queue";

/**
 * Emit an internal event that may trigger workflows
 *
 * @param params Event parameters
 * @returns Number of workflows triggered
 */
export async function emitWorkflowEvent(params: {
  eventName: string;
  contactId: string;
  organizationId: string;
  eventData?: Record<string, unknown>;
  /** Skip recording to contact_event table (for internal events that are already tracked elsewhere) */
  skipEventRecord?: boolean;
}): Promise<{ workflowsTriggered: number }> {
  const { eventName, contactId, organizationId, eventData, skipEventRecord } =
    params;

  // Record the event to contact_event table (for segment evaluation)
  if (!skipEventRecord) {
    try {
      await db.insert(contactEvent).values({
        contactId,
        organizationId,
        eventName,
        eventData,
      });
    } catch (error) {
      // Log but don't fail the event emission
      console.error(
        `[workflow-events] Failed to record event "${eventName}" for contact ${contactId}:`,
        error
      );
    }
  }

  // Find matching workflows
  const matchingWorkflows = await db
    .select({ id: workflow.id })
    .from(workflow)
    .where(
      and(
        eq(workflow.organizationId, organizationId),
        eq(workflow.status, "enabled"),
        eq(workflow.triggerType, "event"),
        sql`${workflow.triggerConfig}->>'eventName' = ${eventName}`
      )
    );

  // Trigger each matching workflow
  for (const wf of matchingWorkflows) {
    await enqueueWorkflowStep({
      type: "trigger",
      workflowId: wf.id,
      contactId,
      organizationId,
      eventData: eventData || {},
    });
  }

  if (matchingWorkflows.length > 0) {
    console.log(
      `[workflow-events] Event "${eventName}" triggered ${matchingWorkflows.length} workflow(s) for contact ${contactId}`
    );
  }

  return { workflowsTriggered: matchingWorkflows.length };
}

/**
 * Emit contact_created event
 */
export async function emitContactCreated(params: {
  contactId: string;
  organizationId: string;
  contactData?: Record<string, unknown>;
}): Promise<{ workflowsTriggered: number }> {
  return emitWorkflowEvent({
    eventName: "contact_created",
    contactId: params.contactId,
    organizationId: params.organizationId,
    eventData: {
      ...params.contactData,
      createdAt: new Date().toISOString(),
    },
  });
}

/**
 * Emit contact_updated event
 */
export async function emitContactUpdated(params: {
  contactId: string;
  organizationId: string;
  updatedFields?: string[];
  contactData?: Record<string, unknown>;
}): Promise<{ workflowsTriggered: number }> {
  return emitWorkflowEvent({
    eventName: "contact_updated",
    contactId: params.contactId,
    organizationId: params.organizationId,
    eventData: {
      ...params.contactData,
      updatedFields: params.updatedFields,
      updatedAt: new Date().toISOString(),
    },
  });
}

/**
 * Emit topic_subscribed event
 */
export async function emitTopicSubscribed(params: {
  contactId: string;
  organizationId: string;
  topicId: string;
  topicName?: string;
}): Promise<{ workflowsTriggered: number }> {
  console.log("[workflow-events] emitTopicSubscribed called:", {
    contactId: params.contactId,
    organizationId: params.organizationId,
    topicId: params.topicId,
  });

  // Also check for topic_subscribed trigger type
  const matchingByEvent = await emitWorkflowEvent({
    eventName: "topic_subscribed",
    contactId: params.contactId,
    organizationId: params.organizationId,
    eventData: {
      topicId: params.topicId,
      topicName: params.topicName,
      subscribedAt: new Date().toISOString(),
    },
  });

  // Check for workflows with topic_subscribed trigger type
  const matchingByTrigger = await db
    .select({ id: workflow.id })
    .from(workflow)
    .where(
      and(
        eq(workflow.organizationId, params.organizationId),
        eq(workflow.status, "enabled"),
        eq(workflow.triggerType, "topic_subscribed"),
        sql`${workflow.triggerConfig}->>'topicId' = ${params.topicId}`
      )
    );

  console.log("[workflow-events] topic_subscribed query result:", {
    organizationId: params.organizationId,
    topicId: params.topicId,
    matchingWorkflows: matchingByTrigger.map((w) => w.id),
  });

  for (const wf of matchingByTrigger) {
    await enqueueWorkflowStep({
      type: "trigger",
      workflowId: wf.id,
      contactId: params.contactId,
      organizationId: params.organizationId,
      eventData: {
        topicId: params.topicId,
        topicName: params.topicName,
        subscribedAt: new Date().toISOString(),
      },
    });
  }

  if (matchingByTrigger.length > 0) {
    console.log(
      `[workflow-events] topic_subscribed trigger matched ${matchingByTrigger.length} workflow(s)`
    );
  }

  return {
    workflowsTriggered:
      matchingByEvent.workflowsTriggered + matchingByTrigger.length,
  };
}

/**
 * Emit topic_unsubscribed event
 *
 * Also cancels any active workflow executions that were triggered by
 * topic_subscribed for this topic.
 */
export async function emitTopicUnsubscribed(params: {
  contactId: string;
  organizationId: string;
  topicId: string;
  topicName?: string;
}): Promise<{ workflowsTriggered: number; executionsCancelled: number }> {
  // Cancel any active executions for topic_subscribed workflows
  const { executionsCancelled } = await cancelExecutionsForTopicUnsubscribe({
    contactId: params.contactId,
    organizationId: params.organizationId,
    topicId: params.topicId,
  });

  // Check for event-based triggers
  const matchingByEvent = await emitWorkflowEvent({
    eventName: "topic_unsubscribed",
    contactId: params.contactId,
    organizationId: params.organizationId,
    eventData: {
      topicId: params.topicId,
      topicName: params.topicName,
      unsubscribedAt: new Date().toISOString(),
    },
  });

  // Check for workflows with topic_unsubscribed trigger type
  const matchingByTrigger = await db
    .select({ id: workflow.id })
    .from(workflow)
    .where(
      and(
        eq(workflow.organizationId, params.organizationId),
        eq(workflow.status, "enabled"),
        eq(workflow.triggerType, "topic_unsubscribed"),
        sql`${workflow.triggerConfig}->>'topicId' = ${params.topicId}`
      )
    );

  for (const wf of matchingByTrigger) {
    await enqueueWorkflowStep({
      type: "trigger",
      workflowId: wf.id,
      contactId: params.contactId,
      organizationId: params.organizationId,
      eventData: {
        topicId: params.topicId,
        topicName: params.topicName,
        unsubscribedAt: new Date().toISOString(),
      },
    });
  }

  if (matchingByTrigger.length > 0) {
    console.log(
      `[workflow-events] topic_unsubscribed trigger matched ${matchingByTrigger.length} workflow(s)`
    );
  }

  return {
    workflowsTriggered:
      matchingByEvent.workflowsTriggered + matchingByTrigger.length,
    executionsCancelled,
  };
}

/**
 * Check and emit segment entry events for a contact
 * Call this after a contact is created or updated
 *
 * Note: This triggers workflows for segments the contact NOW matches.
 * For proper entry/exit tracking, segment membership history would be needed.
 */
export async function checkSegmentEntry(params: {
  contactId: string;
  organizationId: string;
}): Promise<{ workflowsTriggered: number }> {
  // Get workflows with segment_entry trigger
  const segmentWorkflows = await db
    .select({
      id: workflow.id,
      triggerConfig: workflow.triggerConfig,
    })
    .from(workflow)
    .where(
      and(
        eq(workflow.organizationId, params.organizationId),
        eq(workflow.status, "enabled"),
        eq(workflow.triggerType, "segment_entry")
      )
    );

  if (segmentWorkflows.length === 0) {
    return { workflowsTriggered: 0 };
  }

  let triggered = 0;

  // For each segment workflow, check if contact matches segment
  for (const wf of segmentWorkflows) {
    const config = wf.triggerConfig as { segmentId?: string } | null;
    if (!config?.segmentId) {
      continue;
    }

    try {
      // Check if contact matches the segment
      const matches = await contactMatchesSegment(
        params.contactId,
        config.segmentId
      );

      if (matches) {
        // Fetch segment name for event data
        const [seg] = await db
          .select({ name: segment.name })
          .from(segment)
          .where(eq(segment.id, config.segmentId))
          .limit(1);

        await enqueueWorkflowStep({
          type: "trigger",
          workflowId: wf.id,
          contactId: params.contactId,
          organizationId: params.organizationId,
          eventData: {
            segmentId: config.segmentId,
            segmentName: seg?.name,
            enteredAt: new Date().toISOString(),
          },
        });

        triggered++;
        console.log(
          `[workflow-events] Segment entry: contact ${params.contactId} entered segment ${config.segmentId}, triggered workflow ${wf.id}`
        );
      }
    } catch (error) {
      console.error(
        `[workflow-events] Error checking segment ${config.segmentId}:`,
        error
      );
    }
  }

  return { workflowsTriggered: triggered };
}

/**
 * Check and emit segment exit events for a contact
 * Call this after a contact is updated
 *
 * Note: For true segment exit detection, we'd need to track previous
 * segment membership. This implementation checks if the contact
 * does NOT match segments that have exit triggers.
 */
export async function checkSegmentExit(params: {
  contactId: string;
  organizationId: string;
  previousSegmentIds?: string[]; // Optional: segments contact was previously in
}): Promise<{ workflowsTriggered: number }> {
  // Get workflows with segment_exit trigger
  const segmentWorkflows = await db
    .select({
      id: workflow.id,
      triggerConfig: workflow.triggerConfig,
    })
    .from(workflow)
    .where(
      and(
        eq(workflow.organizationId, params.organizationId),
        eq(workflow.status, "enabled"),
        eq(workflow.triggerType, "segment_exit")
      )
    );

  if (segmentWorkflows.length === 0) {
    return { workflowsTriggered: 0 };
  }

  let triggered = 0;

  for (const wf of segmentWorkflows) {
    const config = wf.triggerConfig as { segmentId?: string } | null;
    if (!config?.segmentId) {
      continue;
    }

    // Only check exit if we know the contact was previously in the segment
    if (
      params.previousSegmentIds &&
      !params.previousSegmentIds.includes(config.segmentId)
    ) {
      continue;
    }

    try {
      // Check if contact NO LONGER matches the segment
      const matches = await contactMatchesSegment(
        params.contactId,
        config.segmentId
      );

      if (!matches) {
        // Contact exited the segment
        const [seg] = await db
          .select({ name: segment.name })
          .from(segment)
          .where(eq(segment.id, config.segmentId))
          .limit(1);

        await enqueueWorkflowStep({
          type: "trigger",
          workflowId: wf.id,
          contactId: params.contactId,
          organizationId: params.organizationId,
          eventData: {
            segmentId: config.segmentId,
            segmentName: seg?.name,
            exitedAt: new Date().toISOString(),
          },
        });

        triggered++;
        console.log(
          `[workflow-events] Segment exit: contact ${params.contactId} exited segment ${config.segmentId}, triggered workflow ${wf.id}`
        );
      }
    } catch (error) {
      console.error(
        `[workflow-events] Error checking segment exit ${config.segmentId}:`,
        error
      );
    }
  }

  return { workflowsTriggered: triggered };
}

/**
 * Cancel active workflow executions when a contact unsubscribes from a topic.
 *
 * This finds all active executions for workflows triggered by topic_subscribed
 * with the matching topicId and cancels them.
 */
export async function cancelExecutionsForTopicUnsubscribe(params: {
  contactId: string;
  organizationId: string;
  topicId: string;
}): Promise<{ executionsCancelled: number }> {
  const { contactId, organizationId, topicId } = params;

  // Find workflows triggered by topic_subscribed for this topic
  const matchingWorkflows = await db
    .select({ id: workflow.id })
    .from(workflow)
    .where(
      and(
        eq(workflow.organizationId, organizationId),
        eq(workflow.triggerType, "topic_subscribed"),
        sql`${workflow.triggerConfig}->>'topicId' = ${topicId}`
      )
    );

  if (matchingWorkflows.length === 0) {
    return { executionsCancelled: 0 };
  }

  const workflowIds = matchingWorkflows.map((w) => w.id);

  // Find active executions for this contact in these workflows
  const activeExecutions = await db
    .select({
      id: workflowExecution.id,
      workflowId: workflowExecution.workflowId,
      delaySchedulerName: workflowExecution.delaySchedulerName,
      waitTimeoutSchedulerName: workflowExecution.waitTimeoutSchedulerName,
    })
    .from(workflowExecution)
    .where(
      and(
        eq(workflowExecution.contactId, contactId),
        inArray(workflowExecution.workflowId, workflowIds),
        sql`${workflowExecution.status} IN ('pending', 'active', 'paused', 'waiting')`
      )
    );

  if (activeExecutions.length === 0) {
    return { executionsCancelled: 0 };
  }

  // Cancel each execution
  for (const execution of activeExecutions) {
    // Clean up any scheduled steps
    const schedulerCleanups: Promise<void>[] = [];

    if (execution.delaySchedulerName) {
      schedulerCleanups.push(
        deleteScheduledStep(execution.delaySchedulerName).catch((err) => {
          console.error(
            `[workflow-events] Failed to delete delay scheduler ${execution.delaySchedulerName}:`,
            err
          );
        })
      );
    }

    if (execution.waitTimeoutSchedulerName) {
      schedulerCleanups.push(
        deleteScheduledStep(execution.waitTimeoutSchedulerName).catch((err) => {
          console.error(
            `[workflow-events] Failed to delete timeout scheduler ${execution.waitTimeoutSchedulerName}:`,
            err
          );
        })
      );
    }

    await Promise.all(schedulerCleanups);

    // Mark execution as cancelled
    await db
      .update(workflowExecution)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowExecution.id, execution.id));

    // Decrement active execution count on workflow
    await db
      .update(workflow)
      .set({
        activeExecutions: sql`GREATEST(0, ${workflow.activeExecutions} - 1)`,
      })
      .where(eq(workflow.id, execution.workflowId));
  }

  console.log(
    `[workflow-events] Cancelled ${activeExecutions.length} execution(s) for contact ${contactId} unsubscribing from topic ${topicId}`
  );

  return { executionsCancelled: activeExecutions.length };
}
