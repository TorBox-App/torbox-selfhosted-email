/**
 * Workflow Events Service
 *
 * Handles emitting internal events to trigger workflows.
 * Used for contact lifecycle events, topic subscriptions, etc.
 */

import { contactEvent, db, eq, segment, workflow } from "@wraps/db";
import { and, sql } from "drizzle-orm";

import { contactMatchesSegment } from "./segment-evaluator";
import { enqueueWorkflowStep } from "./workflow-queue";

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
 */
export async function emitTopicUnsubscribed(params: {
  contactId: string;
  organizationId: string;
  topicId: string;
  topicName?: string;
}): Promise<{ workflowsTriggered: number }> {
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
