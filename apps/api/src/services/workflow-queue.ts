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
import {
  SendMessageBatchCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { awsDefaults } from "../lib/aws-defaults";
import { log } from "../lib/logger";

const sqs = new SQSClient(awsDefaults);
const scheduler = new SchedulerClient(awsDefaults);

/**
 * Format a date for EventBridge Scheduler at() expression.
 * Must be in format: at(yyyy-MM-ddTHH:mm:ss) without milliseconds or timezone.
 */
export function formatScheduleExpression(date: Date): string {
  const iso = date.toISOString(); // 2026-01-08T04:37:29.148Z
  const withoutMs = iso.split(".")[0]; // 2026-01-08T04:37:29
  return `at(${withoutMs})`;
}

/**
 * Generate a short schedule name that fits within the 64-char limit.
 * Uses first 8 chars of each UUID to create unique but short names.
 */
export function generateScheduleName(
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
    }
  | {
      type: "schedule-trigger";
      workflowId: string;
      organizationId: string;
    };

/**
 * Enqueue a workflow step for immediate processing
 */
export async function enqueueWorkflowStep(job: WorkflowJob): Promise<void> {
  if (!WORKFLOW_QUEUE_URL) {
    if (IS_PRODUCTION) {
      throw new Error("WORKFLOW_QUEUE_URL not configured");
    }
    log.warn("[workflow-queue] Skipping enqueue - queue not configured", {
      job,
    });
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
 * Enqueue multiple workflow steps in batch (up to 10 per SQS SendMessageBatch call).
 *
 * On partial failure, AWS returns HTTP 200 with Failed[] entries. Per AWS guidance:
 * - SenderFault=true (permanent): bad message content — throw immediately, do not retry.
 * - SenderFault=false (transient): retry only the failed entries with exponential backoff
 *   rather than re-queuing the whole upstream message (which would duplicate successes).
 */
export async function enqueueWorkflowStepBatch(
  jobs: WorkflowJob[]
): Promise<void> {
  if (jobs.length === 0) {
    return;
  }

  if (!WORKFLOW_QUEUE_URL) {
    if (IS_PRODUCTION) {
      throw new Error("WORKFLOW_QUEUE_URL not configured");
    }
    log.warn("[workflow-queue] Skipping batch enqueue - queue not configured", {
      count: jobs.length,
    });
    return;
  }

  // Send one chunk at a time, collecting transient failures for retry.
  // Chunks are sent sequentially (not in parallel) so a partial failure in
  // one chunk doesn't mask failures in another.
  let pending = jobs;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, 100 * 2 ** (attempt - 1))
      );
    }

    const transientRetry: WorkflowJob[] = [];

    // Process in chunks of 10
    for (let i = 0; i < pending.length; i += 10) {
      const chunk = pending.slice(i, i + 10);
      const result = await sqs.send(
        new SendMessageBatchCommand({
          QueueUrl: WORKFLOW_QUEUE_URL,
          Entries: chunk.map((job, idx) => ({
            Id: String(idx),
            MessageBody: JSON.stringify(job),
          })),
        })
      );

      const failed = result.Failed ?? [];
      if (failed.length === 0) continue;

      const permanent = failed.filter((f) => f.SenderFault);
      if (permanent.length > 0) {
        throw new Error(
          `SQS batch permanently failed: ${permanent.length} message(s) with sender fault. Codes: ${permanent.map((f) => f.Code).join(", ")}`
        );
      }

      // Collect transient failures — map Id back to the job in this chunk
      for (const f of failed) {
        const job = chunk[Number(f.Id)];
        if (job) transientRetry.push(job);
      }
    }

    if (transientRetry.length === 0) return;

    if (attempt === MAX_ATTEMPTS - 1) {
      throw new Error(
        `SQS batch failed after ${MAX_ATTEMPTS} attempts: ${transientRetry.length} transient error(s) unresolved`
      );
    }

    log.warn(
      "SQS batch partial failure (transient) — retrying failed entries",
      {
        attempt: attempt + 1,
        retryCount: transientRetry.length,
      }
    );
    pending = transientRetry;
  }
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
    log.warn("[workflow-queue] Skipping schedule creation - config not set");
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
    log.warn("[workflow-queue] Skipping timeout schedule - config not set");
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
      log.warn("[workflow-queue] Skipping schedule deletion - config not set");
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
