import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

/**
 * User webhook configuration
 */
export type UserWebhookConfig = {
  url: string;
  secret: string;
  ruleName: pulumi.Output<string>;
  eventBusName: pulumi.Output<string>;
};

/**
 * User webhook resources output
 */
export type UserWebhookResources = {
  connection: aws.cloudwatch.EventConnection;
  apiDestination: aws.cloudwatch.EventApiDestination;
  target: aws.cloudwatch.EventTarget;
  role: aws.iam.Role;
};

/**
 * Create EventBridge API Destination resources for a user's webhook endpoint.
 *
 * Attaches to the existing SES events rule so the user receives the same
 * events that flow through the platform webhook / SQS pipeline.
 *
 * Resources created:
 *  1. EventConnection  – API_KEY auth with x-wraps-signature header
 *  2. API Destination   – POST to user URL, 300 req/s rate limit
 *  3. IAM Role + Policy – allows EventBridge to invoke the destination
 *  4. EventTarget       – wired to the existing rule with InputTransformer
 */
export function createUserWebhookResources(
  config: UserWebhookConfig
): UserWebhookResources {
  // 1. Connection (stores auth credentials in Secrets Manager)
  const connection = new aws.cloudwatch.EventConnection(
    "wraps-user-webhook-connection",
    {
      name: "wraps-user-webhook-connection",
      description: "Connection for user webhook endpoint",
      authorizationType: "API_KEY",
      authParameters: {
        apiKey: {
          key: "X-Wraps-Signature",
          value: config.secret,
        },
      },
    }
  );

  // 2. API Destination
  const apiDestination = new aws.cloudwatch.EventApiDestination(
    "wraps-user-webhook-destination",
    {
      name: "wraps-user-webhook-destination",
      description: "Send SES events to user webhook endpoint",
      connectionArn: connection.arn,
      httpMethod: "POST",
      invocationEndpoint: config.url,
      invocationRateLimitPerSecond: 300,
    }
  );

  // 3. IAM role for EventBridge to invoke API Destination
  const role = new aws.iam.Role("wraps-user-webhook-role", {
    name: "wraps-user-webhook-role",
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

  // 4. Policy to allow invoking API Destination
  new aws.iam.RolePolicy("wraps-user-webhook-policy", {
    role: role.name,
    policy: apiDestination.arn.apply((destArn) =>
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

  // 5. Target on the existing SES events rule with InputTransformer
  const target = new aws.cloudwatch.EventTarget(
    "wraps-user-webhook-target",
    {
      rule: config.ruleName,
      eventBusName: config.eventBusName,
      arn: apiDestination.arn,
      roleArn: role.arn,
      inputTransformer: {
        inputPaths: {
          event: "$.detail.eventType",
          detail: "$.detail",
          timestamp: "$.time",
          messageId: "$.detail.mail.messageId",
        },
        inputTemplate:
          '{"event":<event>,"detail":<detail>,"timestamp":<timestamp>,"messageId":<messageId>,"source":"wraps"}',
      },
    }
  );

  return {
    connection,
    apiDestination,
    target,
    role,
  };
}
