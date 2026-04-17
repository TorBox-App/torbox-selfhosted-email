import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { getLambdaCode } from "./lambda.js";

/**
 * Lambda inbound configuration
 */
export type LambdaInboundConfig = {
  bucketName: string;
  bucketArn: pulumi.Output<string>;
  accountId: string;
  region: string;
  dlqArn: pulumi.Output<string>;
  /**
   * When true, adds a wildcard `ssm:GetParameter` grant on
   * `/wraps/email/reply-secret/*` and sets the
   * `REPLY_SECRET_PARAMETER_PREFIX` env var so the inbound processor can
   * fetch per-domain signing secrets for reply-threading verification.
   */
  replyThreadingEnabled?: boolean;
};

/**
 * Lambda inbound resources output
 */
export type LambdaInboundResources = {
  lambdaFunction: aws.lambda.Function;
  s3InvokePermission: aws.lambda.Permission;
};

/**
 * Deploy Lambda function for inbound email processing
 *
 * Architecture:
 * S3 (raw/) notification -> Lambda -> S3 (parsed/, attachments/) + EventBridge
 */
export async function deployInboundLambda(
  config: LambdaInboundConfig
): Promise<LambdaInboundResources> {
  // Get Lambda code directory (pre-bundled in production, bundled on-the-fly in dev)
  const inboundProcessorCode = await getLambdaCode("inbound-processor");

  // IAM role for inbound Lambda execution
  const lambdaRole = new aws.iam.Role("wraps-inbound-lambda-role", {
    name: "wraps-inbound-lambda-role",
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
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email-inbound",
    },
  });

  // Attach basic Lambda execution policy (CloudWatch Logs)
  new aws.iam.RolePolicyAttachment("wraps-inbound-lambda-basic-execution", {
    role: lambdaRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });

  // Lambda policy for S3 read/write and EventBridge PutEvents
  new aws.iam.RolePolicy("wraps-inbound-lambda-policy", {
    role: lambdaRole.name,
    policy: pulumi
      .all([config.bucketArn, config.dlqArn])
      .apply(([bucketArn, dlqArn]) => {
        const statements: Record<string, unknown>[] = [
          {
            // S3 read (raw/) and write (parsed/, attachments/)
            Effect: "Allow",
            Action: ["s3:GetObject", "s3:PutObject", "s3:HeadObject"],
            Resource: `${bucketArn}/*`,
          },
          {
            // EventBridge PutEvents for email.received events
            Effect: "Allow",
            Action: ["events:PutEvents"],
            Resource: `arn:aws:events:${config.region}:${config.accountId}:event-bus/default`,
          },
          {
            // SQS access for DLQ
            Effect: "Allow",
            Action: ["sqs:SendMessage"],
            Resource: dlqArn,
          },
        ];

        if (config.replyThreadingEnabled) {
          statements.push({
            // Reply-threading: fetch per-domain signing secrets. Wildcard is
            // scoped to the one SSM path prefix in this account, never
            // cross-tenant.
            Effect: "Allow",
            Action: ["ssm:GetParameter"],
            Resource: `arn:aws:ssm:${config.region}:${config.accountId}:parameter/wraps/email/reply-secret/*`,
          });
        }

        return JSON.stringify({
          Version: "2012-10-17",
          Statement: statements,
        });
      }),
  });

  const functionName = "wraps-inbound-email-processor";

  // Create inbound processor Lambda
  const lambdaFunction = new aws.lambda.Function(functionName, {
    name: functionName,
    runtime: "nodejs20.x",
    handler: "index.handler",
    role: lambdaRole.arn,
    code: new pulumi.asset.FileArchive(inboundProcessorCode),
    timeout: 120,
    memorySize: 1024,
    environment: {
      variables: {
        BUCKET_NAME: config.bucketName,
        INBOUND_EVENT_SOURCE: "wraps.inbound",
        ...(config.replyThreadingEnabled
          ? {
              REPLY_SECRET_PARAMETER_PREFIX: "/wraps/email/reply-secret/",
            }
          : {}),
      },
    },
    deadLetterConfig: {
      targetArn: config.dlqArn,
    },
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email-inbound",
    },
  });

  // Allow S3 to invoke the Lambda function
  const s3InvokePermission = new aws.lambda.Permission(
    "wraps-inbound-s3-invoke",
    {
      action: "lambda:InvokeFunction",
      function: lambdaFunction.name,
      principal: "s3.amazonaws.com",
      sourceArn: config.bucketArn,
      sourceAccount: config.accountId,
    }
  );

  return {
    lambdaFunction,
    s3InvokePermission,
  };
}
