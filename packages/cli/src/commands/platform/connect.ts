/**
 * Platform connect command - Connect AWS infrastructure to Wraps Platform
 *
 * This command combines:
 * 1. EventBridge webhook setup (streaming events to dashboard)
 * 2. IAM role update (granting dashboard read access)
 *
 * Users can run this single command instead of:
 * - `wraps email upgrade` → "Connect to Wraps Dashboard"
 * - `wraps platform update-role`
 */
import {
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { confirm, intro, isCancel, log, outro, select } from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { deployEmailStack } from "../../infrastructure/email-stack.js";
import { trackCommand, trackError } from "../../telemetry/events.js";
import type {
  EmailStackConfig,
  PlatformConnectOptions,
  WrapsEmailConfig,
} from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import {
  generateWebhookSecret,
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import { promptVercelConfig } from "../../utils/shared/prompts.js";
import { ensurePulumiInstalled } from "../../utils/shared/pulumi.js";

/**
 * IAM policy statement type
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

/**
 * Build IAM policy document for platform access role
 */
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
      "ses:GetAccount",
      "ses:GetSendStatistics",
      "ses:ListIdentities",
      "ses:GetIdentityVerificationAttributes",
      "ses:ListEmailIdentities",
      "ses:GetEmailIdentity",
      "ses:GetConfigurationSet",
      "ses:GetConfigurationSetEventDestinations",
      "cloudwatch:GetMetricData",
      "cloudwatch:GetMetricStatistics",
    ],
    Resource: "*",
  });

  // Always allow SES template management
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
        "ses:SendBulkEmail",
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

  // ========== SMS PERMISSIONS ==========

  if (smsConfig) {
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

    const smsSendingEnabled = smsConfig.sendingEnabled !== false;
    if (smsSendingEnabled) {
      statements.push({
        Effect: "Allow",
        Action: ["sms-voice:SendTextMessage", "sms-voice:SendMediaMessage"],
        Resource: "*",
      });
    }

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

/**
 * Connect AWS infrastructure to Wraps Platform
 */
export async function connect(options: PlatformConnectOptions): Promise<void> {
  const startTime = Date.now();

  intro(pc.bold("Connect to Wraps Platform"));

  const progress = new DeploymentProgress();

  try {
    // 1. Check Pulumi CLI is installed
    const wasAutoInstalled = await progress.execute(
      "Checking Pulumi CLI installation",
      async () => await ensurePulumiInstalled()
    );

    if (wasAutoInstalled) {
      progress.info("Pulumi CLI was automatically installed");
    }

    // 2. Validate AWS credentials
    const identity = await progress.execute(
      "Validating AWS credentials",
      async () => validateAWSCredentials()
    );

    progress.info(`Connected to AWS account: ${pc.cyan(identity.accountId)}`);

    // 3. Get region
    let region = options.region;
    if (!region) {
      region = await getAWSRegion();
    }

    // 4. Load connection metadata
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

    // 5. Check what services are deployed
    const hasEmail = !!metadata.services.email?.config;
    const hasSms = !!metadata.services.sms?.config;

    if (!(hasEmail || hasSms)) {
      progress.stop();
      log.error("No services deployed in this region.");
      console.log(
        `\nRun ${pc.cyan("wraps email init")} or ${pc.cyan("wraps sms init")} first.\n`
      );
      process.exit(1);
    }

    progress.info(
      `Found services: ${[hasEmail && "email", hasSms && "sms"].filter(Boolean).join(", ")}`
    );

    // 6. Check and configure webhook for email service
    let webhookSecret: string | undefined;
    let needsDeployment = false;

    if (hasEmail) {
      const emailConfig = metadata.services.email!.config;
      const existingSecret = metadata.services.email!.webhookSecret;

      // Check if event tracking is enabled (required for webhook)
      if (!emailConfig.eventTracking?.enabled) {
        progress.stop();
        log.warn(
          "Event tracking must be enabled to connect to the Wraps Platform."
        );
        log.info(
          "Enabling event tracking will allow SES events to be streamed to the dashboard."
        );

        const enableEventTracking = await confirm({
          message: "Enable event tracking now?",
          initialValue: true,
        });

        if (isCancel(enableEventTracking) || !enableEventTracking) {
          outro("Platform connection cancelled.");
          process.exit(0);
        }

        // Enable event tracking
        metadata.services.email!.config = {
          ...emailConfig,
          eventTracking: {
            enabled: true,
            eventBridge: true,
            events: [
              "SEND",
              "DELIVERY",
              "OPEN",
              "CLICK",
              "BOUNCE",
              "COMPLAINT",
            ],
            dynamoDBHistory:
              emailConfig.eventTracking?.dynamoDBHistory ?? false,
            archiveRetention:
              emailConfig.eventTracking?.archiveRetention ?? "90days",
          },
        };
        needsDeployment = true;
      }

      // Handle existing webhook secret
      if (existingSecret) {
        progress.stop();
        log.info(
          `Already connected to Wraps Platform (AWS Account: ${pc.cyan(metadata.accountId)})`
        );

        const action = await select({
          message: "What would you like to do?",
          options: [
            {
              value: "keep",
              label: "Keep current connection",
              hint: "Continue with existing webhook secret",
            },
            {
              value: "regenerate",
              label: "Regenerate webhook secret",
              hint: "Create new secret (requires update in dashboard)",
            },
            {
              value: "disconnect",
              label: "Disconnect from platform",
              hint: "Stop sending events to Wraps",
            },
          ],
        });

        if (isCancel(action)) {
          outro("Operation cancelled");
          process.exit(0);
        }

        if (action === "keep") {
          webhookSecret = existingSecret;
          // Still continue to update IAM role
        } else if (action === "disconnect") {
          const confirmDisconnect = await confirm({
            message:
              "Are you sure? Events will no longer be sent to the Wraps Platform.",
            initialValue: false,
          });

          if (isCancel(confirmDisconnect) || !confirmDisconnect) {
            outro("Disconnect cancelled");
            process.exit(0);
          }

          metadata.services.email!.webhookSecret = undefined;
          needsDeployment = true;
          // Clear webhookSecret so deployment removes API Destination
          webhookSecret = undefined;
        } else {
          // Regenerate
          webhookSecret = generateWebhookSecret();
          metadata.services.email!.webhookSecret = webhookSecret;
          needsDeployment = true;
        }
      } else {
        // Generate new webhook secret
        webhookSecret = generateWebhookSecret();
        metadata.services.email!.webhookSecret = webhookSecret;
        needsDeployment = true;
      }
    }

    // 7. Deploy stack if needed (for webhook configuration)
    if (needsDeployment && hasEmail) {
      // Get Vercel config if needed
      let vercelConfig;
      if (metadata.provider === "vercel" && !metadata.vercel) {
        progress.stop();
        vercelConfig = await promptVercelConfig();
      } else if (metadata.provider === "vercel") {
        vercelConfig = metadata.vercel;
      }

      const stackConfig: EmailStackConfig = {
        provider: metadata.provider,
        region,
        vercel: vercelConfig,
        emailConfig: metadata.services.email!.config as WrapsEmailConfig,
        webhook: webhookSecret
          ? {
              awsAccountNumber: metadata.accountId,
              webhookSecret,
            }
          : undefined,
      };

      await progress.execute("Configuring event streaming", async () => {
        await ensurePulumiWorkDir();

        const stack =
          await pulumi.automation.LocalWorkspace.createOrSelectStack(
            {
              stackName:
                metadata.services.email?.pulumiStackName ||
                `wraps-${identity.accountId}-${region}`,
              projectName: "wraps-email",
              program: async () => {
                const result = await deployEmailStack(stackConfig);
                return {
                  roleArn: result.roleArn,
                  configSetName: result.configSetName,
                  tableName: result.tableName,
                  region: result.region,
                };
              },
            },
            {
              workDir: getPulumiWorkDir(),
              envVars: {
                PULUMI_CONFIG_PASSPHRASE: "",
                AWS_REGION: region,
              },
              secretsProvider: "passphrase",
            }
          );

        await stack.setConfig("aws:region", { value: region });
        await stack.refresh({ onOutput: () => {} });
        await stack.up({ onOutput: () => {} });
      });

      progress.succeed("Event streaming configured");
    } else if (!needsDeployment && hasEmail && webhookSecret) {
      progress.succeed("Event streaming already configured");
    }

    // 8. Update platform access role
    const roleName = "wraps-console-access-role";
    const iam = new IAMClient({ region: "us-east-1" });

    let roleExists = false;
    try {
      await iam.send(new GetRoleCommand({ RoleName: roleName }));
      roleExists = true;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name !== "NoSuchEntity"
      ) {
        throw error;
      }
    }

    if (roleExists) {
      const emailConfig = metadata.services.email?.config;
      const smsConfig = metadata.services.sms?.config;
      const policy = buildConsolePolicyDocument(emailConfig, smsConfig);

      await progress.execute("Updating platform access role", async () => {
        await iam.send(
          new PutRolePolicyCommand({
            RoleName: roleName,
            PolicyName: "wraps-console-access-policy",
            PolicyDocument: JSON.stringify(policy, null, 2),
          })
        );
      });

      progress.succeed("Platform access role updated");
    } else {
      progress.info(
        `IAM role ${pc.cyan(roleName)} will be created when you add your AWS account in the dashboard`
      );
    }

    // 9. Save metadata
    await saveConnectionMetadata(metadata);

    progress.stop();

    // 10. Display results
    outro(pc.green("Platform connection complete!"));

    if (webhookSecret && needsDeployment) {
      console.log(`\n${pc.bold("Webhook Secret")} ${pc.dim("(save this!)")}`);
      console.log(pc.dim("─".repeat(60)));
      console.log(`  ${pc.cyan(webhookSecret)}`);
      console.log(pc.dim("─".repeat(60)));
    } else if (metadata.services.email?.webhookSecret && !needsDeployment) {
      console.log(`\n${pc.bold("Existing Webhook Secret:")}`);
      console.log(pc.dim("─".repeat(60)));
      console.log(`  ${pc.cyan(metadata.services.email.webhookSecret)}`);
      console.log(pc.dim("─".repeat(60)));
    }

    console.log(`\n${pc.bold("Next Steps:")}`);
    console.log(`  1. Go to ${pc.cyan("https://app.wraps.dev/settings/aws")}`);
    console.log(`  2. Add your AWS account: ${pc.cyan(identity.accountId)}`);
    if (webhookSecret) {
      console.log("  3. Paste the webhook secret shown above");
    }
    console.log();
    console.log(
      pc.dim(
        "Events from your AWS infrastructure will stream to the dashboard."
      )
    );
    console.log();

    // Track success
    const duration = Date.now() - startTime;
    trackCommand("platform:connect", {
      success: true,
      duration_ms: duration,
    });
  } catch (error) {
    progress.stop();

    const duration = Date.now() - startTime;
    const errorCode = error instanceof Error ? error.name : "UNKNOWN_ERROR";
    trackError(errorCode, "platform:connect", {
      message: error instanceof Error ? error.message : String(error),
    });
    trackCommand("platform:connect", {
      success: false,
      duration_ms: duration,
    });

    throw error;
  }
}
