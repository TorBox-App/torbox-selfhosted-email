import * as aws from "@pulumi/aws";
import { sqsQueueExists } from "../shared/resource-checks.js";

/**
 * SQS resources output
 */
export type SQSResources = {
  queue: aws.sqs.Queue;
  dlq: aws.sqs.Queue;
};

/**
 * Create SQS queue with Dead Letter Queue for event processing
 *
 * Architecture:
 * EventBridge -> SQS Queue -> Lambda (event-processor)
 *                    ↓
 *                   DLQ (failed messages after 3 retries)
 *
 * Both queues use the import-or-create pattern: if the queue already exists
 * in AWS but isn't tracked in Pulumi state (e.g., from a prior failed
 * deployment), we import it instead of creating from scratch. Without this,
 * Pulumi's create call hits AWS's QueueAlreadyExists error on tag mismatch.
 * Mirrors the SMS stack pattern in sms-stack.ts:createSMSSQSResources.
 */
// Shared Pulumi resource options for both queues. The 2m timeouts match the
// SMS stack's queue creation pattern and give SQS enough time to settle a
// fresh CreateQueue against eventual-consistency reads on tags.
const SQS_TIMEOUTS = {
  customTimeouts: { create: "2m", update: "2m", delete: "2m" },
} as const;

export type SQSConfig = {
  region: string;
};

export async function createSQSResources(
  config: SQSConfig
): Promise<SQSResources> {
  const dlqName = "wraps-email-events-dlq";
  const queueName = "wraps-email-events";

  const dlqUrl = await sqsQueueExists(dlqName, config.region);
  const queueUrl = await sqsQueueExists(queueName, config.region);

  // Dead Letter Queue for failed event processing
  const dlqConfig = {
    name: dlqName,
    messageRetentionSeconds: 1_209_600, // 14 days
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email",
      Description: "Dead letter queue for failed SES event processing",
    },
  };

  const dlq = new aws.sqs.Queue(dlqName, dlqConfig, {
    ...SQS_TIMEOUTS,
    ...(dlqUrl ? { import: dlqUrl } : {}),
  });

  // Main queue for SES events
  const queueConfig = {
    name: queueName,
    visibilityTimeoutSeconds: 300, // Must be >= Lambda timeout (5 minutes)
    messageRetentionSeconds: 345_600, // 4 days
    receiveWaitTimeSeconds: 20, // Long polling
    redrivePolicy: dlq.arn.apply((arn) =>
      JSON.stringify({
        deadLetterTargetArn: arn,
        maxReceiveCount: 3, // Retry 3 times before sending to DLQ
      })
    ),
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email",
      Description: "Queue for SES email events from EventBridge",
    },
  };

  const queue = new aws.sqs.Queue(queueName, queueConfig, {
    ...SQS_TIMEOUTS,
    ...(queueUrl ? { import: queueUrl } : {}),
  });

  return {
    queue,
    dlq,
  };
}
