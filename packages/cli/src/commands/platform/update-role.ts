import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
} from "@aws-sdk/client-iam";
import { confirm, intro, isCancel, log, outro } from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import type { UpdateRoleOptions } from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Update platform access role command
 *
 * Updates the wraps-console-access-role IAM role with the latest permissions
 * needed for feature detection in the wraps platform (e.g., dynamodb:DescribeTable).
 *
 * This role is created when you connect AWS accounts through the Wraps Platform.
 * This command updates its permissions to match your current infrastructure setup.
 *
 * This command:
 * - Only updates the role if it exists (does not create it)
 * - Updates inline policies to match current feature requirements
 * - Preserves the trust policy (AssumeRole configuration)
 */
export async function updateRole(options: UpdateRoleOptions): Promise<void> {
  const startTime = Date.now();
  if (!isJsonMode()) {
    intro(pc.bold("Update Platform Access Role"));
  }

  const progress = new DeploymentProgress();

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  const region = options.region || (await getAWSRegion());

  // 3. Load metadata to check if deployment exists
  const metadata = await loadConnectionMetadata(identity.accountId, region);
  if (!metadata) {
    progress.stop();
    log.error(
      `No Wraps deployment found for account ${pc.cyan(identity.accountId)} in region ${pc.cyan(region)}`
    );
    console.log(
      `\nRun ${pc.cyan("wraps email init")} to deploy infrastructure first.\n`
    );
    process.exit(1);
  }

  // 4. Check if wraps-console-access-role exists
  const roleName = "wraps-console-access-role";
  const iam = new IAMClient({ region: "us-east-1" }); // IAM is global

  let roleExists = false;
  try {
    await iam.send(new GetRoleCommand({ RoleName: roleName }));
    roleExists = true;
  } catch (error) {
    const isNotFound =
      error instanceof Error &&
      (error.name === "NoSuchEntityException" ||
        error.name === "NoSuchEntity" ||
        error.message.includes("NoSuchEntity"));
    if (!isNotFound) {
      throw error;
    }
  }

  const externalId = metadata.platform?.externalId;

  if (!(roleExists || externalId)) {
    progress.stop();
    log.warn(`IAM role ${pc.cyan(roleName)} does not exist`);
    console.log(
      "\nThis role is created when you connect AWS accounts through the Wraps Platform."
    );
    console.log(
      `Run ${pc.cyan("wraps platform connect")} while logged in to create the role automatically.\n`
    );
    process.exit(0);
  }

  if (roleExists) {
    progress.info(`Found IAM role: ${pc.cyan(roleName)}`);
  } else {
    progress.info(
      `IAM role ${pc.cyan(roleName)} not found — will create it using stored externalId`
    );
  }

  // 5. Confirm update (unless --force)
  if (!options.force) {
    progress.stop();
    const actionLabel = roleExists ? "Update" : "Create";
    const shouldContinue = await confirm({
      message: `${actionLabel} IAM role ${pc.cyan(roleName)} with latest permissions?`,
      initialValue: true,
    });

    if (isCancel(shouldContinue) || !shouldContinue) {
      outro(`${actionLabel} cancelled`);
      process.exit(0);
    }
  }

  // 6. Build updated policy
  const emailConfig = metadata.services.email?.config;
  const smsConfig = metadata.services.sms?.config;
  const policy = buildConsolePolicyDocument(emailConfig, smsConfig);

  // Extract config values for display
  const sendingEnabled =
    !emailConfig ||
    (emailConfig.sendingEnabled as boolean | undefined) !== false;
  const eventTracking = emailConfig?.eventTracking as
    | Record<string, unknown>
    | undefined;
  const emailArchiving = emailConfig?.emailArchiving as
    | Record<string, unknown>
    | undefined;
  const smsEnabled = !!smsConfig;
  const smsSendingEnabled =
    smsConfig && (smsConfig.sendingEnabled as boolean | undefined) !== false;
  const smsEventTracking = smsConfig?.eventTracking as
    | Record<string, unknown>
    | undefined;

  // 7. Create or update role
  if (!roleExists && externalId) {
    const WRAPS_PLATFORM_ACCOUNT_ID = "905130073023";

    await progress.execute("Creating IAM role", async () => {
      const trustPolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              AWS: `arn:aws:iam::${WRAPS_PLATFORM_ACCOUNT_ID}:root`,
            },
            Action: "sts:AssumeRole",
            Condition: {
              StringEquals: {
                "sts:ExternalId": externalId,
              },
            },
          },
        ],
      };

      await iam.send(
        new CreateRoleCommand({
          RoleName: roleName,
          Description:
            "Allows Wraps dashboard to access CloudWatch metrics and SES data",
          AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
          Tags: [
            { Key: "ManagedBy", Value: "wraps-cli" },
            { Key: "Purpose", Value: "Console Access" },
          ],
        })
      );

      const { PutRolePolicyCommand } = await import("@aws-sdk/client-iam");

      await iam.send(
        new PutRolePolicyCommand({
          RoleName: roleName,
          PolicyName: "wraps-console-access-policy",
          PolicyDocument: JSON.stringify(policy, null, 2),
        })
      );
    });
  } else {
    await progress.execute("Updating IAM role permissions", async () => {
      const { PutRolePolicyCommand } = await import("@aws-sdk/client-iam");

      await iam.send(
        new PutRolePolicyCommand({
          RoleName: roleName,
          PolicyName: "wraps-console-access-policy",
          PolicyDocument: JSON.stringify(policy, null, 2),
        })
      );
    });
  }

  progress.stop();

  // Success
  const actionVerb = roleExists ? "updated" : "created";

  trackCommand("platform:update-role", {
    success: true,
    duration_ms: Date.now() - startTime,
    action: actionVerb,
  });

  if (isJsonMode()) {
    jsonSuccess("platform.update-role", {
      updated: true,
      action: actionVerb,
      roleName,
    });
    return;
  }

  outro(pc.green(`✓ Platform access role ${actionVerb} successfully`));

  console.log(`\n${pc.bold("Permissions:")}`);

  // Email permissions
  console.log(`\n  ${pc.bold(pc.cyan("Email:"))}`);
  console.log(
    `  ${pc.green("✓")} SES metrics and identity verification (always enabled)`
  );
  console.log(`  ${pc.green("✓")} SES template management (always enabled)`);
  console.log(`  ${pc.green("✓")} Inbound bucket detection (always enabled)`);

  if (sendingEnabled) {
    console.log(`  ${pc.green("✓")} Email sending via SES`);
  }

  if (eventTracking?.dynamoDBHistory) {
    console.log(
      `  ${pc.green("✓")} DynamoDB read access (including DescribeTable)`
    );
  }

  if (eventTracking?.enabled) {
    console.log(`  ${pc.green("✓")} EventBridge and SQS access`);
  }

  if (emailArchiving?.enabled) {
    console.log(`  ${pc.green("✓")} Mail Manager Archive access`);
  }

  const inbound = emailConfig?.inbound as Record<string, unknown> | undefined;
  if (inbound?.enabled) {
    console.log(`  ${pc.green("✓")} S3 access for inbound email`);
  }

  // SMS permissions
  if (smsEnabled) {
    console.log(`\n  ${pc.bold(pc.cyan("SMS:"))}`);
    console.log(
      `  ${pc.green("✓")} SMS Voice V2 read access (phone numbers, config, registrations)`
    );

    if (smsSendingEnabled) {
      console.log(`  ${pc.green("✓")} SMS sending via SMS Voice V2`);
    }

    if (smsEventTracking?.dynamoDBHistory) {
      console.log(`  ${pc.green("✓")} DynamoDB read access for SMS history`);
    }

    if (smsEventTracking?.enabled) {
      console.log(`  ${pc.green("✓")} SNS topic access for SMS events`);
    }
  }

  console.log(
    `\n${pc.dim(`The Wraps Platform will now have ${actionVerb} permissions for feature detection.`)}\n`
  );
}

/**
 * Build IAM policy document for platform access role
 *
 * This mirrors the permissions from the main wraps-email-role and wraps-sms-role
 * but is used for the Wraps Platform (not for SDK sending or local console).
 */
type PolicyStatement = {
  Effect: string;
  Action: string[];
  Resource: string | string[];
};

type PolicyDocument = {
  Version: string;
  Statement: PolicyStatement[];
};

function buildConsolePolicyDocument(
  emailConfig: Record<string, unknown> | undefined,
  smsConfig?: Record<string, unknown> | undefined
): PolicyDocument {
  const statements: PolicyStatement[] = [];

  // ========== EMAIL PERMISSIONS ==========

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
      // SES dedicated IP scanning
      "ses:GetDedicatedIps",
    ],
    Resource: "*",
  });

  // Always allow S3 HeadBucket for feature detection (inbound bucket scanning)
  // This allows the dashboard to discover if inbound email is deployed
  statements.push({
    Effect: "Allow",
    Action: ["s3:HeadBucket"],
    Resource: "arn:aws:s3:::wraps-inbound-*",
  });

  // Always allow SES template management (for publishing email templates)
  statements.push({
    Effect: "Allow",
    Action: [
      "ses:GetTemplate",
      "ses:ListTemplates",
      "ses:CreateTemplate",
      "ses:UpdateTemplate",
      "ses:DeleteTemplate",
      "ses:TestRenderTemplate",
    ],
    Resource: "*",
  });

  // Allow sending if enabled
  const sendingEnabled = !emailConfig || emailConfig.sendingEnabled !== false;
  if (sendingEnabled) {
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
  const eventTracking = emailConfig?.eventTracking as
    | Record<string, unknown>
    | undefined;
  if (eventTracking?.dynamoDBHistory) {
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
  if (eventTracking?.enabled) {
    statements.push({
      Effect: "Allow",
      Action: ["events:PutEvents", "events:DescribeEventBus"],
      Resource: "arn:aws:events:*:*:event-bus/wraps-email-*",
    });
  }

  // Allow SQS access if event tracking enabled
  if (eventTracking?.enabled) {
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

  // Allow Mail Manager Archive access if email archiving enabled
  const emailArchiving = emailConfig?.emailArchiving as
    | Record<string, unknown>
    | undefined;
  if (emailArchiving?.enabled) {
    statements.push({
      Effect: "Allow",
      Action: [
        "ses:StartArchiveSearch",
        "ses:GetArchiveSearchResults",
        "ses:GetArchiveMessage",
        "ses:GetArchiveMessageContent",
        "ses:GetArchive",
        "ses:ListArchives",
        "ses:StartArchiveExport",
        "ses:GetArchiveExport",
      ],
      Resource: "arn:aws:ses:*:*:mailmanager-archive/*",
    });
  }

  // Allow S3 access for inbound email (bucket scanning and email retrieval)
  const inbound = emailConfig?.inbound as Record<string, unknown> | undefined;
  if (inbound?.enabled) {
    statements.push({
      Effect: "Allow",
      Action: [
        "s3:HeadBucket",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:GetObjectTagging",
      ],
      Resource: [
        "arn:aws:s3:::wraps-inbound-*",
        "arn:aws:s3:::wraps-inbound-*/*",
      ],
    });
  }

  // ========== SMS PERMISSIONS ==========

  if (smsConfig) {
    // Always allow reading SMS metrics and config for dashboard
    statements.push({
      Effect: "Allow",
      Action: [
        "sms-voice:DescribeAccountAttributes",
        "sms-voice:DescribeSpendLimits",
        "sms-voice:DescribeConfigurationSets",
        "sms-voice:DescribeOptOutLists",
        "sms-voice:DescribeOptedOutNumbers",
        "sms-voice:DescribePools",
        "sms-voice:DescribePhoneNumbers",
        "sms-voice:DescribeProtectConfigurations",
        "sms-voice:DescribeRegistrations",
        "sms-voice:DescribeRegistrationAttachments",
        "sms-voice:DescribeRegistrationFieldDefinitions",
        "sms-voice:DescribeRegistrationFieldValues",
        "sms-voice:DescribeRegistrationSectionDefinitions",
        "sms-voice:DescribeRegistrationVersions",
      ],
      Resource: "*",
    });

    // Allow SMS sending if enabled
    const smsSendingEnabled = smsConfig.sendingEnabled !== false;
    if (smsSendingEnabled) {
      statements.push({
        Effect: "Allow",
        Action: ["sms-voice:SendTextMessage", "sms-voice:SendMediaMessage"],
        Resource: "*",
      });
    }

    // Allow DynamoDB access for SMS history if enabled
    const smsEventTracking = smsConfig.eventTracking as
      | Record<string, unknown>
      | undefined;
    if (smsEventTracking?.dynamoDBHistory) {
      statements.push({
        Effect: "Allow",
        Action: [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:DescribeTable",
        ],
        Resource: [
          "arn:aws:dynamodb:*:*:table/wraps-sms-*",
          "arn:aws:dynamodb:*:*:table/wraps-sms-*/index/*",
        ],
      });
    }

    // Allow SNS access for SMS events if enabled
    if (smsEventTracking?.enabled) {
      statements.push({
        Effect: "Allow",
        Action: ["sns:GetTopicAttributes", "sns:ListSubscriptionsByTopic"],
        Resource: "arn:aws:sns:*:*:wraps-sms-*",
      });
    }
  }

  return {
    Version: "2012-10-17",
    Statement: statements,
  };
}
