import type * as aws from "@pulumi/aws";
import type { Provider, WrapsEmailConfig } from "../../types/index.js";
import { createServiceIAMRole } from "../shared/iam.js";

/**
 * IAM role configuration
 */
export type IAMRoleConfig = {
  provider: Provider;
  oidcProvider?: aws.iam.OpenIdConnectProvider;
  vercelTeamSlug?: string;
  vercelProjectName?: string;
  emailConfig: WrapsEmailConfig;
};

/**
 * Create IAM role for email infrastructure
 */
export async function createIAMRole(
  config: IAMRoleConfig
): Promise<aws.iam.Role> {
  // Build policy statements based on enabled features
  const statements: any[] = [];

  // Always allow reading SES metrics for dashboard
  statements.push({
    Effect: "Allow",
    Action: [
      "ses:GetAccount", // Get SES rate limits and quotas
      "ses:GetSendStatistics",
      "ses:ListIdentities",
      "ses:GetIdentityVerificationAttributes",
      // SES v2 API for listing/getting email identities (domains)
      "ses:ListEmailIdentities",
      "ses:GetEmailIdentity",
      // SES v2 API for configuration set scanning (needed by dashboard)
      "ses:GetConfigurationSet",
      "ses:GetConfigurationSetEventDestinations",
      "cloudwatch:GetMetricData",
      "cloudwatch:GetMetricStatistics",
    ],
    Resource: "*",
  });

  // Allow sending if enabled
  if (config.emailConfig.sendingEnabled !== false) {
    statements.push({
      Effect: "Allow",
      Action: [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
        "ses:SendBulkTemplatedEmail",
        "ses:SendBulkEmail", // SES v2 bulk sending
      ],
      Resource: "*",
    });
  }

  // Allow DynamoDB access if history storage enabled
  if (config.emailConfig.eventTracking?.dynamoDBHistory) {
    statements.push({
      Effect: "Allow",
      Action: [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:DescribeTable",
      ],
      Resource: [
        "arn:aws:dynamodb:*:*:table/wraps-email-*",
        "arn:aws:dynamodb:*:*:table/wraps-email-*/index/*",
      ],
    });
  }

  // Allow EventBridge access if event tracking enabled
  if (config.emailConfig.eventTracking?.enabled) {
    statements.push({
      Effect: "Allow",
      Action: ["events:PutEvents", "events:DescribeEventBus"],
      Resource: "arn:aws:events:*:*:event-bus/wraps-email-*",
    });
  }

  // Allow SQS access if event tracking enabled
  if (config.emailConfig.eventTracking?.enabled) {
    statements.push({
      Effect: "Allow",
      Action: [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
      ],
      Resource: "arn:aws:sqs:*:*:wraps-email-*",
    });
  }

  // Allow S3 inbound bucket access if inbound enabled (for SDK inbox operations)
  if (config.emailConfig.inbound?.enabled) {
    statements.push({
      Effect: "Allow",
      Action: [
        "s3:GetObject",
        "s3:ListBucket",
        "s3:HeadObject",
        "s3:DeleteObject",
      ],
      Resource: [
        "arn:aws:s3:::wraps-inbound-*",
        "arn:aws:s3:::wraps-inbound-*/*",
      ],
    });
  }

  // Allow Mail Manager Archive access if email archiving enabled
  if (config.emailConfig.emailArchiving?.enabled) {
    statements.push({
      Effect: "Allow",
      Action: [
        // Archive search operations
        "ses:StartArchiveSearch",
        "ses:GetArchiveSearchResults",
        // Archive message retrieval
        "ses:GetArchiveMessage",
        "ses:GetArchiveMessageContent",
        // Archive metadata
        "ses:GetArchive",
        "ses:ListArchives",
        // Archive export (for future use)
        "ses:StartArchiveExport",
        "ses:GetArchiveExport",
      ],
      Resource: "arn:aws:ses:*:*:mailmanager-archive/*",
    });
  }

  return createServiceIAMRole({
    serviceName: "email",
    provider: config.provider,
    oidcProvider: config.oidcProvider,
    vercelTeamSlug: config.vercelTeamSlug,
    vercelProjectName: config.vercelProjectName,
    policyStatements: statements,
  });
}
