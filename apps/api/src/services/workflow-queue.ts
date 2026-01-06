/**
 * Workflow Queue Service
 *
 * Manages enqueueing workflow steps for processing and scheduling delays.
 */

import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});
const scheduler = new SchedulerClient({});

/**
 * Format a date for EventBridge Scheduler at() expression.
 * Must be in format: at(yyyy-MM-ddTHH:mm:ss) without milliseconds or timezone.
 */
function formatScheduleExpression(date: Date): string {
  const iso = date.toISOString(); // 2026-01-08T04:37:29.148Z
  const withoutMs = iso.split(".")[0]; // 2026-01-08T04:37:29
  return `at(${withoutMs})`;
}

/**
 * Generate a short schedule name that fits within the 64-char limit.
 * Uses first 8 chars of each UUID to create unique but short names.
 */
function generateScheduleName(
  prefix: string,
  executionId: string,
  stepId: string
): string {
  const shortExecId = executionId.slice(0, 8);
  const shortStepId = stepId.slice(0, 8);
  return `${prefix}-${shortExecId}-${shortStepId}`;
}

const WORKFLOW_QUEUE_URL = process.env.WORKFLOW_QUEUE_URL;
const WORKFLOW_QUEUE_ARN = process.env.WORKFLOW_QUEUE_ARN;
const SCHEDULE_GROUP = process.env.SCHEDULER_GROUP_NAME || "wraps-workflows";
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Job types for the workflow queue
 */
export type WorkflowJob =
  | {
      type: "execute";
      executionId: string;
      stepId: string;
      organizationId: string;
    }
  | {
      type: "resume";
      executionId: string;
      branch: "yes" | "no" | "timeout" | "opened" | "clicked" | "bounced";
      organizationId: string;
    }
  | {
      type: "trigger";
      workflowId: string;
      contactId: string;
      organizationId: string;
      eventData?: Record<string, unknown>;
    };

/**
 * Enqueue a workflow step for immediate processing
 */
export async function enqueueWorkflowStep(job: WorkflowJob): Promise<void> {
  if (!WORKFLOW_QUEUE_URL) {
    if (IS_PRODUCTION) {
      throw new Error("WORKFLOW_QUEUE_URL not configured");
    }
    console.warn(
      "[workflow-queue] Skipping enqueue - queue not configured",
      job
    );
    return;
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: WORKFLOW_QUEUE_URL,
      MessageBody: JSON.stringify(job),
    })
  );
}

/**
 * Schedule a workflow step to execute after a delay
 */
export async function scheduleWorkflowStep(params: {
  executionId: string;
  stepId: string;
  organizationId: string;
  delaySeconds: number;
}): Promise<string> {
  const scheduleName = generateScheduleName(
    "wraps-wf",
    params.executionId,
    params.stepId
  );

  if (!(SCHEDULER_ROLE_ARN && WORKFLOW_QUEUE_ARN)) {
    if (IS_PRODUCTION) {
      throw new Error("EventBridge Scheduler not configured for workflows");
    }
    console.warn(
      "[workflow-queue] Skipping schedule creation - config not set"
    );
    return scheduleName;
  }

  const executeAt = new Date(Date.now() + params.delaySeconds * 1000);
  const scheduleExpression = formatScheduleExpression(executeAt);

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
          type: "execute",
          executionId: params.executionId,
          stepId: params.stepId,
          organizationId: params.organizationId,
        } satisfies WorkflowJob),
      },
    })
  );

  return scheduleName;
}

/**
 * Schedule a timeout for wait-for-event step
 */
export async function scheduleWaitTimeout(params: {
  executionId: string;
  stepId: string;
  organizationId: string;
  timeoutSeconds: number;
}): Promise<string> {
  const scheduleName = generateScheduleName(
    "wraps-wf-to",
    params.executionId,
    params.stepId
  );

  if (!(SCHEDULER_ROLE_ARN && WORKFLOW_QUEUE_ARN)) {
    if (IS_PRODUCTION) {
      throw new Error("EventBridge Scheduler not configured for workflows");
    }
    console.warn("[workflow-queue] Skipping timeout schedule - config not set");
    return scheduleName;
  }

  const timeoutAt = new Date(Date.now() + params.timeoutSeconds * 1000);
  const scheduleExpression = formatScheduleExpression(timeoutAt);

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
          type: "resume",
          executionId: params.executionId,
          branch: "timeout",
          organizationId: params.organizationId,
        } satisfies WorkflowJob),
      },
    })
  );

  return scheduleName;
}

/**
 * Delete a scheduled workflow step (for cancellation)
 */
export async function deleteScheduledStep(scheduleName: string): Promise<void> {
  if (!SCHEDULER_ROLE_ARN) {
    if (!IS_PRODUCTION) {
      console.warn(
        "[workflow-queue] Skipping schedule deletion - config not set"
      );
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
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      return;
    }
    throw error;
  }
}
