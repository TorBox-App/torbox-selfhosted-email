import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";

/**
 * Self-hosted control-plane webhook configuration
 */
export type SelfhostWebhookConfig = {
  /** BASE url of the self-hosted API; `/webhooks/ses/{account}` is appended here. */
  webhookUrl: string;
  /** API key issued by the self-hosted control plane. */
  webhookSecret: string;
  /** The customer's 12-digit AWS account ID. */
  awsAccountNumber: string;
  ruleName: pulumi.Output<string>;
  eventBusName: pulumi.Output<string>;
  dlqArn: pulumi.Output<string>;
};

/**
 * Self-hosted control-plane webhook resources output
 */
export type SelfhostWebhookResources = {
  connection: aws.cloudwatch.EventConnection;
  apiDestination: aws.cloudwatch.EventApiDestination;
  target: aws.cloudwatch.EventTarget;
  role: aws.iam.Role;
};

/**
 * Create EventBridge API Destination resources for a self-hosted control
 * plane running in the customer's own AWS account.
 *
 * Delivers the SAME SES event stream as the platform webhook so a customer
 * can run a self-hosted control plane and keep the Wraps platform dashboard
 * live at the same time. Each control plane has its own database and its own
 * webhook secret — they do not contend for anything, they both just ingest.
 *
 * Resources created:
 *  1. EventConnection  – API_KEY auth with X-Wraps-Api-Key header
 *  2. API Destination   – POST to `{webhookUrl}/webhooks/ses/{account}`, 300 req/s rate limit
 *  3. IAM Role + Policy – allows EventBridge to invoke the destination
 *  4. EventTarget       – wired to the existing rule with a DLQ (raw SES event envelope, no InputTransformer)
 */
export function createSelfhostWebhookResources(
  config: SelfhostWebhookConfig
): SelfhostWebhookResources {
  // 1. Connection (stores auth credentials in Secrets Manager)
  const connection = new aws.cloudwatch.EventConnection(
    "wraps-selfhost-webhook-connection",
    {
      name: "wraps-selfhost-webhook-connection",
      description: "Connection for self-hosted control-plane webhook endpoint",
      authorizationType: "API_KEY",
      authParameters: {
        apiKey: {
          key: "X-Wraps-Api-Key",
          value: config.webhookSecret,
        },
      },
    }
  );

  // 2. API Destination
  const apiDestination = new aws.cloudwatch.EventApiDestination(
    "wraps-selfhost-webhook-destination",
    {
      name: "wraps-selfhost-webhook-destination",
      description: "Send SES events to self-hosted control-plane endpoint",
      connectionArn: connection.arn,
      httpMethod: "POST",
      invocationEndpoint: `${config.webhookUrl}/webhooks/ses/${config.awsAccountNumber}`,
      invocationRateLimitPerSecond: 300,
    }
  );

  // 3. IAM role for EventBridge to invoke API Destination
  const role = new aws.iam.Role("wraps-selfhost-webhook-role", {
    name: "wraps-selfhost-webhook-role",
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
  new aws.iam.RolePolicy("wraps-selfhost-webhook-policy", {
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

  // 5. Target on the existing SES events rule. Carries a DLQ (unlike the user
  // webhook target) and no InputTransformer — the self-hosted control plane
  // runs the same `apps/api` code as the platform and expects the raw SES
  // event envelope, exactly as the platform target delivers it.
  //
  // NOTE: EventBridge allows 5 targets per rule (hard AWS quota, not
  // adjustable). This rule now carries SQS + platform webhook + user webhook
  // + this selfhost webhook = 4. One slot remains.
  const target = new aws.cloudwatch.EventTarget(
    "wraps-selfhost-webhook-target",
    {
      rule: config.ruleName,
      eventBusName: config.eventBusName,
      arn: apiDestination.arn,
      roleArn: role.arn,
      deadLetterConfig: { arn: config.dlqArn },
    }
  );

  return {
    connection,
    apiDestination,
    target,
    role,
  };
}
