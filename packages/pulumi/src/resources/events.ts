import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type {
  ResolvedConfig,
  TransformFunctions,
  WebhookConfig,
} from "../types.js";

/**
 * DynamoDB table result
 */
export type DynamoDBResult = {
  table: aws.dynamodb.Table;
};

/**
 * SQS resources result
 */
export type SQSResult = {
  queue: aws.sqs.Queue;
  dlq: aws.sqs.Queue;
};

/**
 * EventBridge resources result
 */
export type EventBridgeResult = {
  rule: aws.cloudwatch.EventRule;
  target: aws.cloudwatch.EventTarget;
  queuePolicy: aws.sqs.QueuePolicy;
  webhookConnection?: aws.cloudwatch.EventConnection;
  webhookApiDestination?: aws.cloudwatch.EventApiDestination;
  webhookTarget?: aws.cloudwatch.EventTarget;
};

/**
 * Create DynamoDB table for email history
 */
export function createHistoryTable(
  name: string,
  tags: Record<string, string>,
  transform?: TransformFunctions["table"],
  opts?: pulumi.ComponentResourceOptions
): DynamoDBResult {
  let args: aws.dynamodb.TableArgs = {
    name: "wraps-email-history",
    billingMode: "PAY_PER_REQUEST",
    hashKey: "messageId",
    rangeKey: "sentAt",
    attributes: [
      { name: "messageId", type: "S" },
      { name: "sentAt", type: "N" },
      { name: "accountId", type: "S" },
    ],
    globalSecondaryIndexes: [
      {
        name: "accountId-sentAt-index",
        hashKey: "accountId",
        rangeKey: "sentAt",
        projectionType: "ALL",
      },
    ],
    ttl: {
      enabled: true,
      attributeName: "expiresAt",
    },
    tags,
  };

  // Apply transform if provided
  if (transform) {
    args = transform(args);
  }

  const table = new aws.dynamodb.Table(`${name}-history-table`, args, opts);

  return { table };
}

/**
 * Create SQS queue with Dead Letter Queue for event processing
 */
export function createEventQueues(
  name: string,
  tags: Record<string, string>,
  transform?: {
    queue?: TransformFunctions["queue"];
    dlq?: TransformFunctions["dlq"];
  },
  opts?: pulumi.ComponentResourceOptions
): SQSResult {
  // Dead Letter Queue for failed event processing
  let dlqArgs: aws.sqs.QueueArgs = {
    name: "wraps-email-events-dlq",
    messageRetentionSeconds: 1_209_600, // 14 days
    tags: {
      ...tags,
      Description: "Dead letter queue for failed SES event processing",
    },
  };

  if (transform?.dlq) {
    dlqArgs = transform.dlq(dlqArgs);
  }

  const dlq = new aws.sqs.Queue(`${name}-events-dlq`, dlqArgs, opts);

  // Main queue for SES events
  let queueArgs: aws.sqs.QueueArgs = {
    name: "wraps-email-events",
    visibilityTimeoutSeconds: 300, // 5 minutes (Lambda timeout)
    messageRetentionSeconds: 345_600, // 4 days
    receiveWaitTimeSeconds: 20, // Long polling
    redrivePolicy: dlq.arn.apply((arn) =>
      JSON.stringify({
        deadLetterTargetArn: arn,
        maxReceiveCount: 3,
      })
    ),
    tags: {
      ...tags,
      Description: "Queue for SES email events from EventBridge",
    },
  };

  if (transform?.queue) {
    queueArgs = transform.queue(queueArgs);
  }

  const queue = new aws.sqs.Queue(`${name}-events-queue`, queueArgs, opts);

  return { queue, dlq };
}

/**
 * Create EventBridge rule and targets for routing SES events
 */
export function createEventBridgeRule(
  name: string,
  queueArn: pulumi.Output<string>,
  queueUrl: pulumi.Output<string>,
  tags: Record<string, string>,
  webhook?: WebhookConfig,
  transform?: TransformFunctions["eventRule"],
  opts?: pulumi.ComponentResourceOptions
): EventBridgeResult {
  // EventBridge rule to capture all SES events on default bus
  let ruleArgs: aws.cloudwatch.EventRuleArgs = {
    name: "wraps-email-events-to-sqs",
    description: "Route all SES email events to SQS for processing",
    eventBusName: "default", // SES only sends to default bus
    eventPattern: JSON.stringify({
      source: ["aws.ses"],
    }),
    tags,
  };

  if (transform) {
    ruleArgs = transform(ruleArgs);
  }

  const rule = new aws.cloudwatch.EventRule(
    `${name}-events-rule`,
    ruleArgs,
    opts
  );

  // SQS queue policy to allow EventBridge to send messages
  const queuePolicy = new aws.sqs.QueuePolicy(
    `${name}-events-queue-policy`,
    {
      queueUrl,
      policy: pulumi.all([queueArn, rule.arn]).apply(([qArn, rArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "events.amazonaws.com" },
              Action: "sqs:SendMessage",
              Resource: qArn,
              Condition: {
                ArnEquals: { "aws:SourceArn": rArn },
              },
            },
          ],
        })
      ),
    },
    opts
  );

  // EventBridge target to send events to SQS
  const target = new aws.cloudwatch.EventTarget(
    `${name}-events-target`,
    {
      rule: rule.name,
      eventBusName: "default",
      arn: queueArn,
    },
    opts
  );

  // Create API Destination for Wraps webhook (if configured)
  let webhookConnection: aws.cloudwatch.EventConnection | undefined;
  let webhookApiDestination: aws.cloudwatch.EventApiDestination | undefined;
  let webhookTarget: aws.cloudwatch.EventTarget | undefined;

  if (webhook) {
    const { awsAccountNumber, webhookSecret, webhookUrl } = webhook;
    const baseUrl = webhookUrl || "https://api.wraps.dev";

    // Connection (stores auth credentials in Secrets Manager)
    webhookConnection = new aws.cloudwatch.EventConnection(
      `${name}-webhook-connection`,
      {
        name: "wraps-webhook-connection",
        description: "Connection for Wraps platform webhook",
        authorizationType: "API_KEY",
        authParameters: {
          apiKey: {
            key: "X-Wraps-Api-Key",
            value: webhookSecret,
          },
        },
      },
      opts
    );

    // API Destination
    webhookApiDestination = new aws.cloudwatch.EventApiDestination(
      `${name}-webhook-destination`,
      {
        name: "wraps-webhook-destination",
        description: "Send SES events to Wraps platform",
        connectionArn: webhookConnection.arn,
        httpMethod: "POST",
        invocationEndpoint: `${baseUrl}/webhooks/ses/${awsAccountNumber}`,
        invocationRateLimitPerSecond: 300,
      },
      opts
    );

    // IAM role for EventBridge to invoke API Destination
    const webhookRole = new aws.iam.Role(
      `${name}-webhook-role`,
      {
        name: "wraps-eventbridge-webhook-role",
        assumeRolePolicy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "events.amazonaws.com" },
              Action: "sts:AssumeRole",
            },
          ],
        }),
        tags,
      },
      opts
    );

    // Policy to allow invoking API Destination
    new aws.iam.RolePolicy(
      `${name}-webhook-policy`,
      {
        role: webhookRole.name,
        policy: webhookApiDestination.arn.apply((destArn) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: ["events:InvokeApiDestination"],
                Resource: destArn,
              },
            ],
          })
        ),
      },
      opts
    );

    // Webhook target
    webhookTarget = new aws.cloudwatch.EventTarget(
      `${name}-webhook-target`,
      {
        rule: rule.name,
        eventBusName: "default",
        arn: webhookApiDestination.arn,
        roleArn: webhookRole.arn,
      },
      opts
    );
  }

  return {
    rule,
    target,
    queuePolicy,
    webhookConnection,
    webhookApiDestination,
    webhookTarget,
  };
}

/**
 * Create all event tracking infrastructure
 */
export function createEventTracking(
  name: string,
  config: ResolvedConfig,
  tags: Record<string, string>,
  transform?: TransformFunctions,
  opts?: pulumi.ComponentResourceOptions
): {
  table?: aws.dynamodb.Table;
  queue: aws.sqs.Queue;
  dlq: aws.sqs.Queue;
  eventRule: aws.cloudwatch.EventRule;
  eventTarget: aws.cloudwatch.EventTarget;
  webhookConnection?: aws.cloudwatch.EventConnection;
  webhookApiDestination?: aws.cloudwatch.EventApiDestination;
  webhookTarget?: aws.cloudwatch.EventTarget;
} {
  // Create DynamoDB table if history storage is enabled
  let table: aws.dynamodb.Table | undefined;
  if (config.events?.storeHistory) {
    const dynamoResult = createHistoryTable(name, tags, transform?.table, opts);
    table = dynamoResult.table;
  }

  // Create SQS queues
  const sqsResult = createEventQueues(
    name,
    tags,
    { queue: transform?.queue, dlq: transform?.dlq },
    opts
  );

  // Create EventBridge rule
  const eventBridgeResult = createEventBridgeRule(
    name,
    sqsResult.queue.arn,
    sqsResult.queue.url,
    tags,
    config.webhook,
    transform?.eventRule,
    opts
  );

  return {
    table,
    queue: sqsResult.queue,
    dlq: sqsResult.dlq,
    eventRule: eventBridgeResult.rule,
    eventTarget: eventBridgeResult.target,
    webhookConnection: eventBridgeResult.webhookConnection,
    webhookApiDestination: eventBridgeResult.webhookApiDestination,
    webhookTarget: eventBridgeResult.webhookTarget,
  };
}
