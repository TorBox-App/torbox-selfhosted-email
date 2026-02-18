/**
 * Workflow Scheduler Service
 *
 * Manages one-time EventBridge Schedules for schedule-triggered workflows.
 * Uses croner to compute the next run time from a cron expression, then
 * creates a one-time at() schedule that fires at that exact moment.
 * When the schedule fires, the processor chains the next one.
 */

import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { Cron } from "croner";

import { log } from "../lib/logger";
import { formatScheduleExpression, type WorkflowJob } from "./workflow-queue";

const scheduler = new SchedulerClient({});

const WORKFLOW_QUEUE_ARN = process.env.WORKFLOW_QUEUE_ARN;
const SCHEDULE_GROUP = process.env.SCHEDULER_GROUP_NAME || "wraps-workflows";
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Generate a deterministic schedule name for a workflow.
 * Only one pending schedule per workflow at a time.
 */
function getScheduleName(workflowId: string): string {
  return `wraps-wf-sched-${workflowId.slice(0, 8)}`;
}

/**
 * Create the next one-time EventBridge Schedule for a schedule-triggered workflow.
 *
 * Uses croner to compute nextRun() from the cron expression + timezone,
 * then creates an at() schedule targeting the workflow SQS queue.
 */
export async function createNextWorkflowSchedule(params: {
  workflowId: string;
  organizationId: string;
  cronExpression: string;
  timezone?: string;
}): Promise<string | null> {
  const { workflowId, organizationId, cronExpression, timezone } = params;

  // Compute next run time
  const cron = new Cron(cronExpression, {
    timezone: timezone || "UTC",
  });

  const nextRun = cron.nextRun();

  if (!nextRun) {
    log.warn("Scheduler: no future run time, chain ends", {
      workflowId,
      cronExpression,
    });
    return null;
  }

  const scheduleName = getScheduleName(workflowId);

  if (!(SCHEDULER_ROLE_ARN && WORKFLOW_QUEUE_ARN)) {
    if (IS_PRODUCTION) {
      throw new Error(
        "EventBridge Scheduler not configured for workflow schedules"
      );
    }
    log.warn("Scheduler: skipping schedule creation, config not set", {
      workflowId,
      nextRun: nextRun.toISOString(),
    });
    return scheduleName;
  }

  const scheduleExpression = formatScheduleExpression(nextRun);

  log.info("Scheduler: creating schedule", {
    scheduleName,
    workflowId,
    nextRun: nextRun.toISOString(),
  });

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: SCHEDULE_GROUP,
      ScheduleExpression: scheduleExpression,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE",
      Target: {
        Arn: WORKFLOW_QUEUE_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          type: "schedule-trigger",
          workflowId,
          organizationId,
        } satisfies WorkflowJob),
      },
    })
  );

  return scheduleName;
}

/**
 * Delete the pending schedule for a workflow.
 * Handles ResourceNotFoundException gracefully (schedule may have already fired).
 */
export async function deleteWorkflowSchedule(
  workflowId: string
): Promise<void> {
  const scheduleName = getScheduleName(workflowId);

  if (!SCHEDULER_ROLE_ARN) {
    if (!IS_PRODUCTION) {
      log.warn("Scheduler: skipping schedule deletion, config not set");
      return;
    }
    return;
  }

  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        Name: scheduleName,
        GroupName: SCHEDULE_GROUP,
      })
    );
    log.info("Scheduler: deleted schedule", { scheduleName, workflowId });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      // Schedule already fired and auto-deleted, or never existed
      return;
    }
    throw error;
  }
}
