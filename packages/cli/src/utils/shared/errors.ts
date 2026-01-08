import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackError } from "../../telemetry/events.js";

/**
 * Custom error class for Wraps CLI errors
 */
export class WrapsError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public docsUrl?: string
  ) {
    super(message);
    this.name = "WrapsError";
  }
}

/**
 * Global error handler for CLI errors
 * Formats and displays errors with suggestions and docs
 */
export function handleCLIError(error: unknown): never {
  console.error(""); // Blank line

  if (error instanceof WrapsError) {
    // Track error (code only, never message)
    trackError(error.code, "unknown");

    clack.log.error(error.message);

    if (error.suggestion) {
      console.log(`\n${pc.yellow("Suggestion:")}`);
      console.log(`  ${pc.white(error.suggestion)}\n`);
    }

    if (error.docsUrl) {
      console.log(`${pc.dim("Documentation:")}`);
      console.log(`  ${pc.blue(error.docsUrl)}\n`);
    }

    process.exit(1);
  }

  // Unknown error
  trackError("UNKNOWN_ERROR", "unknown");

  clack.log.error("An unexpected error occurred");
  console.error(error);
  console.log(`\n${pc.dim("If this persists, please report at:")}`);
  console.log(`  ${pc.blue("https://github.com/wraps-team/wraps/issues")}\n`);
  process.exit(1);
}

/**
 * Common error factory functions
 */
export const errors = {
  noAWSCredentials: () =>
    new WrapsError(
      "AWS credentials not found",
      "NO_AWS_CREDENTIALS",
      "Run: aws configure\nOr set AWS_PROFILE environment variable",
      "https://wraps.dev/docs/guides/aws-setup"
    ),

  stackExists: (stackName: string) =>
    new WrapsError(
      `Stack "${stackName}" already exists`,
      "STACK_EXISTS",
      `To update: wraps email upgrade\nTo remove: wraps destroy --stack ${stackName}`,
      "https://wraps.dev/docs/cli-reference"
    ),

  invalidRegion: (region: string) =>
    new WrapsError(
      `Invalid AWS region: ${region}`,
      "INVALID_REGION",
      "Use a valid AWS region like: us-east-1, eu-west-1, ap-southeast-1",
      "https://docs.aws.amazon.com/general/latest/gr/rande.html"
    ),

  pulumiError: (message: string) =>
    new WrapsError(
      `Infrastructure deployment failed: ${message}`,
      "PULUMI_ERROR",
      "Check your AWS permissions and try again",
      "https://wraps.dev/docs/guides/aws-setup/troubleshooting"
    ),

  noStack: () =>
    new WrapsError(
      "No Wraps infrastructure found in this AWS account",
      "NO_STACK",
      "Run: wraps email init\nTo deploy new infrastructure",
      "https://wraps.dev/docs/quickstart/email"
    ),

  pulumiNotInstalled: () =>
    new WrapsError(
      "Pulumi CLI is not installed",
      "PULUMI_NOT_INSTALLED",
      "Install Pulumi:\n  macOS: brew install pulumi/tap/pulumi\n  Linux: curl -fsSL https://get.pulumi.com | sh\n  Windows: choco install pulumi\n\nOr download from: https://www.pulumi.com/docs/install/",
      "https://www.pulumi.com/docs/install/"
    ),

  stackLocked: () =>
    new WrapsError(
      "The Pulumi stack is locked from a previous run",
      "STACK_LOCKED",
      "This happens when a previous deployment was interrupted.\n\nTo unlock, run:\n  rm -rf ~/.wraps/pulumi/.pulumi/locks\n\nThen try your command again.",
      "https://wraps.dev/docs/guides/aws-setup/troubleshooting"
    ),

  // SMS-specific errors
  smsNotConfigured: () =>
    new WrapsError(
      "SMS infrastructure not found",
      "SMS_NOT_CONFIGURED",
      "Run: wraps sms init\nTo deploy SMS infrastructure",
      "https://wraps.dev/docs/quickstart/sms"
    ),

  smsPhoneNotVerified: () =>
    new WrapsError(
      "Phone number registration not complete",
      "SMS_PHONE_NOT_VERIFIED",
      "Toll-free numbers require registration (15+ days).\nCheck status in AWS console.",
      "https://wraps.dev/docs/quickstart/sms"
    ),

  smsOptedOut: (phoneNumber: string) =>
    new WrapsError(
      `Destination number ${phoneNumber} has opted out`,
      "SMS_OPTED_OUT",
      "The recipient has opted out of receiving messages.\nThey can opt back in by texting START to your number.",
      "https://wraps.dev/docs/quickstart/sms"
    ),

  smsSpendingLimit: () =>
    new WrapsError(
      "AWS SMS spending limit reached",
      "SMS_SPENDING_LIMIT",
      "Request a spending limit increase in the AWS console:\nAWS → End User Messaging → Account Settings → Spending Limits",
      "https://docs.aws.amazon.com/sms-voice/latest/userguide/spend-limit-increase.html"
    ),

  smsInvalidPhoneNumber: (phoneNumber: string) =>
    new WrapsError(
      `Invalid phone number format: ${phoneNumber}`,
      "SMS_INVALID_PHONE_NUMBER",
      "Phone numbers must be in E.164 format:\n  Example: +14155551234 (US)\n  Example: +447911123456 (UK)",
      "https://wraps.dev/docs/sms-sdk-reference"
    ),

  smsSimulatorLimit: () =>
    new WrapsError(
      "Simulator daily message limit reached (100 messages)",
      "SMS_SIMULATOR_LIMIT",
      "Upgrade to a toll-free number for production use:\n  wraps sms upgrade --phone-type toll-free",
      "https://wraps.dev/docs/cli-reference"
    ),

  // SMTP-specific errors
  smtpRequiresSending: () =>
    new WrapsError(
      "SMTP credentials require email sending to be enabled",
      "SMTP_REQUIRES_SENDING",
      "Enable sending first:\n  wraps email upgrade\nAnd select 'Custom configuration' to enable sending.",
      "https://wraps.dev/docs/cli-reference"
    ),

  smtpCredentialsNotFound: () =>
    new WrapsError(
      "SMTP credentials not found",
      "SMTP_CREDENTIALS_NOT_FOUND",
      "Enable SMTP credentials:\n  wraps email upgrade\nAnd select 'Enable SMTP credentials'",
      "https://wraps.dev/docs/cli-reference"
    ),
};
