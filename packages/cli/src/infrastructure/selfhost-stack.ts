import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type {
  SelfhostStackConfig,
  SelfhostStackOutputs,
} from "../types/selfhost.js";

/**
 * Deploy self-hosted control plane infrastructure using Pulumi.
 * All resources use the wraps-selfhost- prefix and ManagedBy: wraps-cli tag.
 */
export async function deploySelfhostStack(
  config: SelfhostStackConfig
): Promise<SelfhostStackOutputs> {
  // 1. IAM Lambda execution role
  const role = new aws.iam.Role("wraps-selfhost-lambda-role", {
    name: "wraps-selfhost-lambda-role",
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  // Attach basic Lambda execution policy
  new aws.iam.RolePolicyAttachment("wraps-selfhost-lambda-policy", {
    role: role.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });

  // Scheduler IAM role — created before the Lambda inline policy so we can scope
  // iam:PassRole to this ARN instead of "*" (prevents privilege escalation via
  // scheduler:CreateSchedule + PassRole(AdministratorAccess) path).
  const schedulerRole = new aws.iam.Role("wraps-selfhost-scheduler-role", {
    name: "wraps-selfhost-scheduler-role",
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "scheduler.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  // Inline policy for DynamoDB + SQS + Scheduler + SES access
  new aws.iam.RolePolicy("wraps-selfhost-lambda-inline-policy", {
    role: role.name,
    policy: schedulerRole.arn.apply((schedulerRoleArn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem",
              "dynamodb:Query",
              "dynamodb:Scan",
            ],
            Resource: `arn:aws:dynamodb:${config.region}:${config.accountId}:table/wraps-selfhost-*`,
          },
          {
            Effect: "Allow",
            Action: [
              "sqs:SendMessage",
              "sqs:ReceiveMessage",
              "sqs:DeleteMessage",
              "sqs:GetQueueAttributes",
            ],
            Resource: `arn:aws:sqs:${config.region}:${config.accountId}:wraps-selfhost-*`,
          },
          {
            Effect: "Allow",
            Action: ["scheduler:CreateSchedule", "scheduler:DeleteSchedule"],
            Resource: "*",
          },
          {
            Effect: "Allow",
            Action: ["iam:PassRole"],
            Resource: schedulerRoleArn,
          },
          {
            Effect: "Allow",
            Action: [
              "ses:SendEmail",
              "ses:SendRawEmail",
              "ses:SendTemplatedEmail",
            ],
            Resource: "*",
          },
        ],
      })
    ),
  });

  // 2. DynamoDB rate-limit table
  const rateLimitTable = new aws.dynamodb.Table("wraps-selfhost-rate-limit", {
    name: "wraps-selfhost-rate-limit",
    billingMode: "PAY_PER_REQUEST",
    hashKey: "pk",
    rangeKey: "sk",
    attributes: [
      { name: "pk", type: "S" },
      { name: "sk", type: "S" },
    ],
    ttl: { enabled: true, attributeName: "expiresAt" },
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  // 3. SQS batch queue + DLQ
  const batchDlq = new aws.sqs.Queue("wraps-selfhost-batch-dlq", {
    name: "wraps-selfhost-batch-dlq",
    messageRetentionSeconds: 1_209_600,
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  const batchQueue = new aws.sqs.Queue("wraps-selfhost-batch", {
    name: "wraps-selfhost-batch",
    visibilityTimeoutSeconds: 300,
    redrivePolicy: batchDlq.arn.apply((arn) =>
      JSON.stringify({ deadLetterTargetArn: arn, maxReceiveCount: 3 })
    ),
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  // 4. SQS workflow queue + DLQ
  const workflowDlq = new aws.sqs.Queue("wraps-selfhost-workflow-dlq", {
    name: "wraps-selfhost-workflow-dlq",
    messageRetentionSeconds: 1_209_600,
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  const workflowQueue = new aws.sqs.Queue("wraps-selfhost-workflow", {
    name: "wraps-selfhost-workflow",
    visibilityTimeoutSeconds: 300,
    redrivePolicy: workflowDlq.arn.apply((arn) =>
      JSON.stringify({ deadLetterTargetArn: arn, maxReceiveCount: 3 })
    ),
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  // 5. EventBridge Scheduler group
  const schedulerGroup = new aws.scheduler.ScheduleGroup(
    "wraps-selfhost-schedulers",
    {
      name: "wraps-selfhost-schedulers",
      tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
    }
  );

  new aws.iam.RolePolicy("wraps-selfhost-scheduler-inline-policy", {
    role: schedulerRole.name,
    policy: batchQueue.arn.apply((arn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "sqs:SendMessage",
            Resource: arn,
          },
        ],
      })
    ),
  });

  // 6. Lambda function (reads from pre-built zip)
  const lambdaFn = new aws.lambda.Function("wraps-selfhost-api", {
    name: "wraps-selfhost-api",
    runtime: "nodejs24.x",
    handler: "lambda.handler",
    role: role.arn,
    code: new pulumi.asset.FileArchive(config.lambdaZipPath),
    timeout: 300,
    memorySize: 512,
    environment: {
      variables: {
        NODE_ENV: "production",
        DATABASE_URL: config.databaseUrl,
        WRAPS_LICENSE_KEY: config.licenseKey,
        NEXT_PUBLIC_APP_URL: config.appUrl,
        UNSUBSCRIBE_SECRET: config.unsubscribeSecret,
        BETTER_AUTH_SECRET: config.betterAuthSecret,
        BATCH_QUEUE_URL: batchQueue.url,
        BATCH_QUEUE_ARN: batchQueue.arn,
        RATE_LIMIT_TABLE_NAME: rateLimitTable.name,
        WORKFLOW_QUEUE_URL: workflowQueue.url,
        WORKFLOW_QUEUE_ARN: workflowQueue.arn,
        SCHEDULER_ROLE_ARN: schedulerRole.arn,
        SCHEDULER_GROUP_NAME: schedulerGroup.name,
      },
    },
    tags: { ManagedBy: "wraps-cli", Service: "selfhost" },
  });

  // Lambda Function URL (no API Gateway)
  const functionUrl = new aws.lambda.FunctionUrl("wraps-selfhost-api-url", {
    functionName: lambdaFn.name,
    authorizationType: "NONE",
    cors: {
      allowCredentials: true,
      allowHeaders: ["*"],
      allowMethods: ["*"],
      allowOrigins: [config.appUrl],
    },
  });

  // SQS event source mappings
  new aws.lambda.EventSourceMapping("wraps-selfhost-batch-esm", {
    functionName: lambdaFn.name,
    eventSourceArn: batchQueue.arn,
    batchSize: 1,
  });

  new aws.lambda.EventSourceMapping("wraps-selfhost-workflow-esm", {
    functionName: lambdaFn.name,
    eventSourceArn: workflowQueue.arn,
    batchSize: 1,
  });

  // Return outputs — Pulumi Output<string> cast to string at the boundary
  // (mirrors the `as any as string` pattern used throughout email-stack.ts)
  return {
    apiUrl: functionUrl.functionUrl as any as string,
    lambdaArn: lambdaFn.arn as any as string,
    lambdaRoleArn: role.arn as any as string,
    rateLimitTableName: rateLimitTable.name as any as string,
    batchQueueUrl: batchQueue.url as any as string,
    batchQueueArn: batchQueue.arn as any as string,
    workflowQueueUrl: workflowQueue.url as any as string,
    workflowQueueArn: workflowQueue.arn as any as string,
    schedulerRoleArn: schedulerRole.arn as any as string,
    schedulerGroupName: schedulerGroup.name as any as string,
  };
}
