import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

/**
 * EventBridge resources configuration
 */
export type EventBridgeConfig = {
  eventBusArn: pulumi.Output<string>;
  queueArn: pulumi.Output<string>;
  queueUrl: pulumi.Output<string>;
  // Target dead-letter queue ARN. EventBridge retries a target 24h/185 times
  // then drops the event; this ARN gives it somewhere to put the event
  // instead of dropping it silently (see May-Jul 2026 incident).
  dlqArn: pulumi.Output<string>;
  // SNS topic ARN for the FailedInvocations alarm (from alerting resources).
  // Alarm is still created without this — just without actions.
  alertTopicArn?: pulumi.Input<string>;
  // Webhook configuration for Wraps platform
  webhook?: {
    awsAccountNumber: string; // The user's 12-digit AWS account ID
    webhookSecret: string; // API key for webhook authentication
    webhookUrl?: string; // Override webhook URL (defaults to api.wraps.dev)
  };
  // User webhook configuration
  userWebhook?: {
    url: string;
    secret: string;
  };
};

/**
 * EventBridge resources output
 */
export type EventBridgeResources = {
  rule: aws.cloudwatch.EventRule;
  target: aws.cloudwatch.EventTarget;
  // Alarm on FailedInvocations for the rule (covers both a dead SQS target
  // and a 4xx-ing webhook destination, since the metric is per-rule).
  failedInvocationsAlarm: aws.cloudwatch.MetricAlarm;
  // API Destination resources (optional)
  webhookConnection?: aws.cloudwatch.EventConnection;
  webhookApiDestination?: aws.cloudwatch.EventApiDestination;
  webhookTarget?: aws.cloudwatch.EventTarget;
  // User webhook resources (optional)
  userWebhookConnection?: aws.cloudwatch.EventConnection;
  userWebhookApiDestination?: aws.cloudwatch.EventApiDestination;
  userWebhookTarget?: aws.cloudwatch.EventTarget;
};

/**
 * Create EventBridge rule to route SES events to SQS queue
 *
 * This rule captures all SES events from the default event bus
 * and routes them to the SQS queue for processing.
 *
 * Note: SES can only send to the default EventBridge bus, not custom buses.
 */
export async function createEventBridgeResources(
  config: EventBridgeConfig
): Promise<EventBridgeResources> {
  // Extract event bus name from ARN (will be "default" for SES)
  const eventBusName = config.eventBusArn.apply((arn) => arn.split("/").pop()!);

  // EventBridge rule to capture all SES events on default bus
  const rule = new aws.cloudwatch.EventRule("wraps-email-events-rule", {
    name: "wraps-email-events-to-sqs",
    description: "Route all SES email events to SQS for processing",
    eventBusName,
    eventPattern: JSON.stringify({
      source: ["aws.ses"],
      // SES sends events with various detail-types based on event type
      // We capture all by not filtering on detail-type
    }),
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email",
    },
  });

  // SQS queue policy to allow EventBridge to send messages
  new aws.sqs.QueuePolicy("wraps-email-events-queue-policy", {
    queueUrl: config.queueUrl,
    policy: pulumi
      .all([config.queueArn, rule.arn])
      .apply(([queueArn, ruleArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "events.amazonaws.com",
              },
              Action: "sqs:SendMessage",
              Resource: queueArn,
              Condition: {
                ArnEquals: {
                  "aws:SourceArn": ruleArn,
                },
              },
            },
          ],
        })
      ),
  });

  // EventBridge target to send events to SQS
  const target = new aws.cloudwatch.EventTarget("wraps-email-events-target", {
    rule: rule.name,
    eventBusName,
    arn: config.queueArn,
    deadLetterConfig: { arn: config.dlqArn },
  });

  // Create API Destination for Wraps webhook (if configured)
  let webhookConnection: aws.cloudwatch.EventConnection | undefined;
  let webhookApiDestination: aws.cloudwatch.EventApiDestination | undefined;
  let webhookTarget: aws.cloudwatch.EventTarget | undefined;

  if (config.webhook) {
    const { awsAccountNumber, webhookSecret, webhookUrl } = config.webhook;
    const baseUrl = webhookUrl || "https://api.wraps.dev";

    // 1. Create Connection (stores auth credentials in Secrets Manager)
    webhookConnection = new aws.cloudwatch.EventConnection(
      "wraps-webhook-connection",
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
      }
    );

    // 2. Create API Destination
    webhookApiDestination = new aws.cloudwatch.EventApiDestination(
      "wraps-webhook-destination",
      {
        name: "wraps-webhook-destination",
        description: "Send SES events to Wraps platform",
        connectionArn: webhookConnection.arn,
        httpMethod: "POST",
        invocationEndpoint: `${baseUrl}/webhooks/ses/${awsAccountNumber}`,
        invocationRateLimitPerSecond: 300, // Rate limit
      }
    );

    // 3. Create IAM role for EventBridge to invoke API Destination
    const webhookRole = new aws.iam.Role("wraps-webhook-role", {
      name: "wraps-eventbridge-webhook-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "events.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email",
      },
    });

    // 4. Attach policy to allow invoking API Destination
    new aws.iam.RolePolicy("wraps-webhook-policy", {
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
    });

    // 5. Add webhook as second target to the rule
    webhookTarget = new aws.cloudwatch.EventTarget("wraps-webhook-target", {
      rule: rule.name,
      eventBusName,
      arn: webhookApiDestination.arn,
      roleArn: webhookRole.arn,
      deadLetterConfig: { arn: config.dlqArn },
    });
  }

  // Create user webhook API Destination (if configured)
  let userWebhookConnection: aws.cloudwatch.EventConnection | undefined;
  let userWebhookApiDestination: aws.cloudwatch.EventApiDestination | undefined;
  let userWebhookTarget: aws.cloudwatch.EventTarget | undefined;

  if (config.userWebhook) {
    const { createUserWebhookResources } = await import(
      "./eventbridge-user-webhook.js"
    );
    const userWebhookResources = createUserWebhookResources({
      url: config.userWebhook.url,
      secret: config.userWebhook.secret,
      ruleName: rule.name,
      eventBusName,
    });
    userWebhookConnection = userWebhookResources.connection;
    userWebhookApiDestination = userWebhookResources.apiDestination;
    userWebhookTarget = userWebhookResources.target;
  }

  // Alarm on delivery failures for the rule's targets. FailedInvocations is
  // per-rule, so this alarm covers both the SQS target and the webhook
  // target (dead target or deauthorized destination). Created even without
  // an alert topic so the failure state is still visible in the console and
  // via `wraps email doctor`.
  const alarmActions = config.alertTopicArn
    ? [config.alertTopicArn]
    : undefined;
  const failedInvocationsAlarm = new aws.cloudwatch.MetricAlarm(
    "wraps-email-events-delivery-failures",
    {
      name: "wraps-email-events-delivery-failures",
      namespace: "AWS/Events",
      metricName: "FailedInvocations",
      dimensions: { RuleName: "wraps-email-events-to-sqs" },
      statistic: "Sum",
      period: 300,
      evaluationPeriods: 3,
      threshold: 1,
      comparisonOperator: "GreaterThanOrEqualToThreshold",
      treatMissingData: "notBreaching",
      alarmDescription:
        "SES event delivery from EventBridge is failing (dead target or deauthorized webhook). Event history is being lost — run `wraps email doctor`.",
      ...(alarmActions ? { alarmActions, okActions: alarmActions } : {}),
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email",
      },
    }
  );

  return {
    rule,
    target,
    failedInvocationsAlarm,
    webhookConnection,
    webhookApiDestination,
    webhookTarget,
    userWebhookConnection,
    userWebhookApiDestination,
    userWebhookTarget,
  };
}
