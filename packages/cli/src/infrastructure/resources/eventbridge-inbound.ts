import * as aws from "@pulumi/aws";

/**
 * EventBridge inbound configuration
 */
export type EventBridgeInboundConfig = {
  webhookUrl?: string;
  webhookSecret?: string;
};

/**
 * EventBridge inbound resources output
 */
export type EventBridgeInboundResources = {
  rule: aws.cloudwatch.EventRule;
  webhookConnection?: aws.cloudwatch.EventConnection;
  webhookApiDestination?: aws.cloudwatch.EventApiDestination;
  webhookTarget?: aws.cloudwatch.EventTarget;
};

/**
 * Create EventBridge rule and optional webhook for inbound email events
 *
 * Matches events on the default bus with source: "wraps.inbound"
 * If webhookUrl is provided, routes events to an API Destination
 */
export function createEventBridgeInboundResources(
  config: EventBridgeInboundConfig
): EventBridgeInboundResources {
  // EventBridge rule to capture inbound email events on default bus
  const rule = new aws.cloudwatch.EventRule("wraps-inbound-events-rule", {
    name: "wraps-inbound-events-to-webhook",
    description: "Route inbound email events to webhook",
    eventBusName: "default",
    eventPattern: JSON.stringify({
      source: ["wraps.inbound"],
      "detail-type": ["email.received"],
    }),
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email-inbound",
    },
  });

  let webhookConnection: aws.cloudwatch.EventConnection | undefined;
  let webhookApiDestination: aws.cloudwatch.EventApiDestination | undefined;
  let webhookTarget: aws.cloudwatch.EventTarget | undefined;

  if (config.webhookUrl && config.webhookSecret) {
    // 1. Create Connection (stores auth credentials in Secrets Manager)
    webhookConnection = new aws.cloudwatch.EventConnection(
      "wraps-inbound-webhook-connection",
      {
        name: "wraps-inbound-webhook-connection",
        description: "Connection for inbound email webhook",
        authorizationType: "API_KEY",
        authParameters: {
          apiKey: {
            key: "X-Wraps-Inbound-Key",
            value: config.webhookSecret,
          },
        },
      }
    );

    // 2. Create API Destination
    webhookApiDestination = new aws.cloudwatch.EventApiDestination(
      "wraps-inbound-webhook-destination",
      {
        name: "wraps-inbound-webhook-destination",
        description: "Send inbound email events to user webhook",
        connectionArn: webhookConnection.arn,
        httpMethod: "POST",
        invocationEndpoint: config.webhookUrl,
        invocationRateLimitPerSecond: 100,
      }
    );

    // 3. Create IAM role for EventBridge to invoke API Destination
    const webhookRole = new aws.iam.Role("wraps-inbound-webhook-role", {
      name: "wraps-inbound-eventbridge-webhook-role",
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
        Service: "email-inbound",
      },
    });

    // 4. Attach policy to allow invoking API Destination
    new aws.iam.RolePolicy("wraps-inbound-webhook-policy", {
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

    // 5. Add webhook as target
    webhookTarget = new aws.cloudwatch.EventTarget(
      "wraps-inbound-webhook-target",
      {
        rule: rule.name,
        eventBusName: "default",
        arn: webhookApiDestination.arn,
        roleArn: webhookRole.arn,
      }
    );
  }

  return {
    rule,
    webhookConnection,
    webhookApiDestination,
    webhookTarget,
  };
}
