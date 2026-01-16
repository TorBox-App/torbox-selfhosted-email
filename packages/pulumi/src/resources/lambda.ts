import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { TransformFunctions } from "../types.js";

/**
 * Get the package root directory (where package.json lives)
 */
function getPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }

  throw new Error("Could not find package.json");
}

/**
 * Get the path to the Lambda event processor code
 */
function getLambdaPath(): string {
  const packageRoot = getPackageRoot();
  const lambdaPath = join(packageRoot, "dist", "lambda", "event-processor");
  const bundleMarker = join(lambdaPath, ".bundled");

  if (existsSync(bundleMarker)) {
    return lambdaPath;
  }

  throw new Error(
    `Lambda code not found: ${lambdaPath}\n` +
      "Make sure to build the package first: pnpm build"
  );
}

/**
 * Lambda function result
 */
export type LambdaResult = {
  lambda: aws.lambda.Function;
  lambdaRole: aws.iam.Role;
  eventSourceMapping: aws.lambda.EventSourceMapping;
};

/**
 * Create Lambda function for processing SES events
 */
export function createEventProcessor(
  name: string,
  tableName: pulumi.Output<string>,
  queueArn: pulumi.Output<string>,
  accountId: pulumi.Output<string>,
  retentionDays: number,
  tags: Record<string, string>,
  transform?: TransformFunctions["lambda"],
  opts?: pulumi.ComponentResourceOptions
): LambdaResult {
  // IAM role for Lambda execution
  const lambdaRole = new aws.iam.Role(
    `${name}-lambda-role`,
    {
      name: "wraps-email-lambda-role",
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
      tags,
    },
    opts
  );

  // Attach basic Lambda execution policy
  new aws.iam.RolePolicyAttachment(
    `${name}-lambda-basic-execution`,
    {
      role: lambdaRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    },
    opts
  );

  // Lambda policy for DynamoDB and SQS
  new aws.iam.RolePolicy(
    `${name}-lambda-policy`,
    {
      role: lambdaRole.name,
      policy: pulumi.all([tableName, queueArn]).apply(([tName, qArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "DynamoDBAccess",
              Effect: "Allow",
              Action: [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:UpdateItem",
              ],
              Resource: [
                `arn:aws:dynamodb:*:*:table/${tName}`,
                `arn:aws:dynamodb:*:*:table/${tName}/index/*`,
              ],
            },
            {
              Sid: "SQSAccess",
              Effect: "Allow",
              Action: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
              ],
              Resource: qArn,
            },
          ],
        })
      ),
    },
    opts
  );

  // Create Lambda function using pre-bundled code from core package
  let lambdaArgs: aws.lambda.FunctionArgs = {
    name: "wraps-email-event-processor",
    runtime: "nodejs20.x",
    handler: "index.handler",
    role: lambdaRole.arn,
    code: new pulumi.asset.FileArchive(getLambdaPath()),
    timeout: 300, // 5 minutes (matches SQS visibility timeout)
    memorySize: 512,
    environment: {
      variables: {
        TABLE_NAME: tableName,
        AWS_ACCOUNT_ID: accountId,
        RETENTION_DAYS: retentionDays.toString(),
      },
    },
    tags: {
      ...tags,
      Description: "Process SES email events from SQS and store in DynamoDB",
    },
  };

  // Apply transform if provided
  if (transform) {
    lambdaArgs = transform(lambdaArgs);
  }

  const lambda = new aws.lambda.Function(
    `${name}-event-processor`,
    lambdaArgs,
    opts
  );

  // Create SQS event source mapping
  const eventSourceMapping = new aws.lambda.EventSourceMapping(
    `${name}-event-source-mapping`,
    {
      eventSourceArn: queueArn,
      functionName: lambda.name,
      batchSize: 10,
      maximumBatchingWindowInSeconds: 5,
      functionResponseTypes: ["ReportBatchItemFailures"],
    },
    opts
  );

  return {
    lambda,
    lambdaRole,
    eventSourceMapping,
  };
}
