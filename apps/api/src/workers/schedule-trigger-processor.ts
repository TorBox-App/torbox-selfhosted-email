/**
 * Schedule Trigger Processor
 *
 * Lambda handler that runs periodically (e.g., every minute) to check
 * for schedule-triggered workflows and start their executions.
 *
 * This handler:
 * 1. Queries all enabled workflows with triggerType = "schedule"
 * 2. Parses the cron expression for each workflow
 * 3. Checks if the current time matches the cron pattern
 * 4. For matching workflows, triggers executions for all contacts in the org
 *    (or a specific segment if segmentId is configured)
 */

import {
  contact,
  db,
  eq,
  segment,
  type TriggerConfig,
  workflow,
} from "@wraps/db";
import type { ScheduledHandler } from "aws-lambda";
import { Cron } from "croner";
import { and } from "drizzle-orm";

import { contactMatchesSegment } from "../services/segment-evaluator";
import { enqueueWorkflowStep } from "../services/workflow-queue";

// Maximum contacts to process per workflow per trigger
// Prevents overwhelming the queue for large segments
const MAX_CONTACTS_PER_TRIGGER = 1000;

export const handler: ScheduledHandler = async () => {
  const now = new Date();
  console.log(
    `[schedule-trigger] Starting schedule check at ${now.toISOString()}`
  );

  // Find all enabled workflows with schedule trigger
  const scheduleWorkflows = await db
    .select()
    .from(workflow)
    .where(
      and(eq(workflow.status, "enabled"), eq(workflow.triggerType, "schedule"))
    );

  console.log(
    `[schedule-trigger] Found ${scheduleWorkflows.length} schedule-triggered workflows`
  );

  let totalTriggered = 0;

  for (const wf of scheduleWorkflows) {
    const config = wf.triggerConfig as TriggerConfig;

    if (!config.schedule) {
      console.log(
        `[schedule-trigger] Workflow ${wf.id} has no cron schedule configured, skipping`
      );
      continue;
    }

    try {
      // Parse the cron expression
      const cron = new Cron(config.schedule, {
        timezone: config.timezone || "UTC",
      });

      // Check if this cron should have triggered in the last minute
      // We check the previous run time to see if it falls within our window
      const previousRun = cron.previousRun();
      if (!previousRun) {
        continue;
      }

      // Calculate the time window (last minute)
      const windowStart = new Date(now.getTime() - 60_000);
      const windowEnd = now;

      // Check if the previous run falls within our 1-minute window
      const shouldTrigger =
        previousRun.getTime() >= windowStart.getTime() &&
        previousRun.getTime() <= windowEnd.getTime();

      if (!shouldTrigger) {
        continue;
      }

      console.log(
        `[schedule-trigger] Workflow ${wf.id} "${wf.name}" matches schedule, triggering`
      );

      // Get contacts to trigger for
      let contacts: { id: string }[];

      if (config.segmentId) {
        // Get contacts from the segment
        contacts = await getSegmentContacts(
          config.segmentId,
          wf.organizationId
        );
      } else {
        // Get all active contacts in the organization
        contacts = await db
          .select({ id: contact.id })
          .from(contact)
          .where(
            and(
              eq(contact.organizationId, wf.organizationId),
              eq(contact.status, "active")
            )
          )
          .limit(MAX_CONTACTS_PER_TRIGGER);
      }

      console.log(
        `[schedule-trigger] Triggering workflow ${wf.id} for ${contacts.length} contacts`
      );

      // Trigger workflow for each contact
      for (const c of contacts) {
        await enqueueWorkflowStep({
          type: "trigger",
          workflowId: wf.id,
          contactId: c.id,
          organizationId: wf.organizationId,
          eventData: {
            triggerType: "schedule",
            triggeredAt: now.toISOString(),
            cronExpression: config.schedule,
          },
        });
        totalTriggered++;
      }

      // Update last triggered timestamp
      await db
        .update(workflow)
        .set({ lastTriggeredAt: now })
        .where(eq(workflow.id, wf.id));
    } catch (error) {
      console.error(
        `[schedule-trigger] Error processing workflow ${wf.id}:`,
        error
      );
      // Continue processing other workflows
    }
  }

  console.log(
    `[schedule-trigger] Complete. Triggered ${totalTriggered} workflow executions.`
  );
};

/**
 * Get contacts that match a segment's filter criteria
 *
 * This evaluates the segment condition for each active contact in the org.
 * Note: This is O(n) per contact which can be slow for large organizations.
 * A future optimization would generate SQL from segment conditions.
 */
async function getSegmentContacts(
  segmentId: string,
  organizationId: string
): Promise<{ id: string }[]> {
  // First verify the segment exists
  const [seg] = await db
    .select({ id: segment.id })
    .from(segment)
    .where(
      and(eq(segment.id, segmentId), eq(segment.organizationId, organizationId))
    )
    .limit(1);

  if (!seg) {
    console.log(`[schedule-trigger] Segment ${segmentId} not found`);
    return [];
  }

  // Get all active contacts in the organization
  const allContacts = await db
    .select({ id: contact.id })
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        eq(contact.status, "active")
      )
    )
    .limit(MAX_CONTACTS_PER_TRIGGER);

  console.log(
    `[schedule-trigger] Evaluating segment ${segmentId} for ${allContacts.length} contacts`
  );

  // Filter contacts by segment membership
  const matchingContacts: { id: string }[] = [];

  for (const c of allContacts) {
    try {
      const matches = await contactMatchesSegment(c.id, segmentId);
      if (matches) {
        matchingContacts.push(c);
      }
    } catch (error) {
      console.error(
        `[schedule-trigger] Error evaluating contact ${c.id} for segment ${segmentId}:`,
        error
      );
      // Continue with other contacts
    }
  }

  console.log(
    `[schedule-trigger] Found ${matchingContacts.length} contacts matching segment ${segmentId}`
  );

  return matchingContacts;
}
