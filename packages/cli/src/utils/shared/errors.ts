import * as clack from "@clack/prompts";

import pc from "picocolors";
import { trackError } from "../../telemetry/events.js";
import { isJsonMode, jsonError } from "./json-output.js";

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
 * Check if an error is an AWS SDK error
 */
export function isAWSError(
  error: unknown
): error is Error & { name: string; $metadata?: { httpStatusCode?: number } } {
  if (!(error instanceof Error)) {
    return false;
  }
  const awsErrorNames = [
    "ExpiredTokenException",
    "InvalidClientTokenId",
    "AccessDenied",
    "AccessDeniedException",
    "UnauthorizedAccess",
    "InvalidAccessKeyId",
    "SignatureDoesNotMatch",
    "UnrecognizedClientException",
    "CredentialsError",
    "TokenRefreshRequired",
    "SSOTokenExpired",
  ];
  return awsErrorNames.includes(error.name) || "$metadata" in error;
}

/**
 * Check if a DNS resolution error indicates a genuinely missing record
 * vs a network/DNS issue that should be surfaced to the user.
 *
 * Returns 'missing' for ENOTFOUND/ENODATA (record doesn't exist),
 * 'network' for ETIMEOUT/ESERVFAIL (DNS infrastructure issue),
 * or 'unknown' for other errors that should be re-thrown.
 */
export function classifyDNSError(
  error: unknown
): "missing" | "network" | "unknown" {
  if (!(error instanceof Error)) {
    return "unknown";
  }
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOTFOUND" || code === "ENODATA") {
    return "missing";
  }
  if (code === "ETIMEOUT" || code === "ESERVFAIL" || code === "ECONNREFUSED") {
    return "network";
  }
  return "unknown";
}

/**
 * Check if an error is an AWS SDK "not found" type error.
 * Does not gate on isAWSError() because these specific error names
 * are unambiguous — if the name matches, it's a not-found error.
 */
export function isAWSNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const awsError = error as Error & {
    $metadata?: { httpStatusCode?: number };
  };
  return (
    error.name === "NotFoundException" ||
    error.name === "NoSuchEntityException" ||
    error.name === "NoSuchEntity" ||
    error.name === "ResourceNotFoundException" ||
    awsError.$metadata?.httpStatusCode === 404
  );
}

/**
 * Check if an error is a Pulumi deployment error
 */
export function isPulumiError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message?.includes("pulumi") ||
    error.message?.includes("Pulumi") ||
    error.message?.includes("resource") ||
    error.message?.includes("creating") ||
    error.message?.includes("AccessDenied")
  );
}

/**
 * Parse AWS SDK error to extract code and action
 */
export function parseAWSError(error: Error): {
  code: string;
  action?: string;
  resource?: string;
} {
  const errorName = error.name || "UnknownError";

  // Extract action from error message if possible
  const actionMatch = error.message?.match(/when calling the (\w+) operation/i);
  const action = actionMatch?.[1];

  // Extract resource from error message if possible
  const resourceMatch = error.message?.match(/resource[:\s]+([^\s,]+)/i);
  const resource = resourceMatch?.[1];

  return { code: errorName, action, resource };
}

/**
 * Parse Pulumi error to extract IAM action that failed
 */
export function parsePulumiError(error: Error): {
  code: string;
  iamAction?: string;
  service?: string;
  resourceName?: string;
  resourceType?: string;
} {
  const message = error.message || "";

  // Check for AccessDenied patterns
  if (message.includes("AccessDenied") || message.includes("access denied")) {
    // Try to extract the AWS action
    const actionMatch = message.match(
      /(?:action|operation)[:\s]+["']?(\w+:\w+)["']?/i
    );
    if (actionMatch) {
      const [service] = actionMatch[1].split(":");
      return {
        code: "IAM_PERMISSION_DENIED",
        iamAction: actionMatch[1],
        service,
      };
    }

    // Try to extract service from resource patterns
    if (message.includes("ses:") || message.includes("SES")) {
      return { code: "SES_PERMISSION_DENIED", service: "ses" };
    }
    if (message.includes("dynamodb:") || message.includes("DynamoDB")) {
      return { code: "DYNAMODB_PERMISSION_DENIED", service: "dynamodb" };
    }
    if (message.includes("lambda:") || message.includes("Lambda")) {
      return { code: "LAMBDA_PERMISSION_DENIED", service: "lambda" };
    }
    if (message.includes("events:") || message.includes("EventBridge")) {
      return { code: "EVENTBRIDGE_PERMISSION_DENIED", service: "events" };
    }
    if (message.includes("sqs:") || message.includes("SQS")) {
      return { code: "SQS_PERMISSION_DENIED", service: "sqs" };
    }
    if (message.includes("iam:") || message.includes("IAM")) {
      return { code: "IAM_PERMISSION_DENIED", service: "iam" };
    }

    return { code: "IAM_PERMISSION_DENIED" };
  }

  // Check for resource conflict (already exists)
  if (
    message.includes("AlreadyExists") ||
    message.includes("already exists") ||
    message.includes("already exist") ||
    message.includes("ResourceConflictException") ||
    message.includes("ResourceInUse") ||
    message.includes("EntityAlreadyExists")
  ) {
    // Extract resource name from "error creating 'name'" pattern
    const nameMatch = message.match(/error creating '([^']+)'/);
    // Extract resource type from "(aws:service/type:Type)" pattern
    const typeMatch = message.match(/\((aws:[^)]+)\)/);

    return {
      code: "RESOURCE_CONFLICT",
      resourceName: nameMatch?.[1],
      resourceType: typeMatch?.[1],
    };
  }

  // Check for stack locked
  if (message.includes("stack is currently locked")) {
    return { code: "STACK_LOCKED" };
  }

  return { code: "PULUMI_ERROR" };
}

/**
 * Strip sensitive values (account IDs, emails, non-AWS domains, ARN account
 * portions) from a string. Used as the redaction layer for both error
 * messages displayed to users and free-form output (e.g. Pulumi deploy logs)
 * that may end up in bug reports.
 *
 * Does NOT truncate — callers that need length limits should apply them
 * after redaction. Splitting redaction from truncation lets the multi-line
 * Pulumi tail dump in `email connect` redact a 60-line block without losing
 * 90% of it to a 500-char cutoff.
 */
export function redactSensitiveValues(input: string): string {
  let message = input;

  // Remove AWS account IDs (12 digits)
  message = message.replace(/\b\d{12}\b/g, "[ACCOUNT_ID]");

  // Remove email addresses
  message = message.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL]"
  );

  // Remove domain names (but keep AWS service domains)
  message = message.replace(
    /(?<!\.amazonaws\.com|\.aws\.amazon\.com)\b[a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g,
    (match) => {
      // Keep AWS domains
      if (match.includes("amazonaws") || match.includes("aws.amazon")) {
        return match;
      }
      return "[DOMAIN]";
    }
  );

  // Remove ARNs (replace account ID portion)
  message = message.replace(
    /arn:aws:[^:]+:[^:]*:\d{12}:/g,
    "arn:aws:[SERVICE]:[REGION]:[ACCOUNT_ID]:"
  );

  return message;
}

/**
 * Sanitize an error for display: strip sensitive values and truncate.
 * Returns "Unknown error" for null/undefined input so the result is always
 * a non-empty user-facing string.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }

  const raw = error instanceof Error ? error.message : String(error);
  const redacted = redactSensitiveValues(raw);

  // Truncate very long messages so a wall-of-text error doesn't break
  // the CLI's formatted output.
  if (redacted.length > 500) {
    return `${redacted.slice(0, 500)}...`;
  }
  return redacted;
}

/**
 * Global error handler for CLI errors
 * Formats and displays errors with suggestions and docs
 * Tracks ALL errors to telemetry (with sanitized context)
 *
 * @param error - The error to handle
 * @param command - Optional command name for telemetry context
 */
export function handleCLIError(error: unknown, command?: string): never {
  const cmdContext = command || "unknown";

  // In JSON mode, convert any error to a JSON envelope and exit
  if (isJsonMode()) {
    let code = "UNKNOWN_ERROR";
    let message = "An unexpected error occurred";
    let suggestion: string | undefined;
    let docsUrl: string | undefined;

    if (error instanceof WrapsError) {
      trackError(error.code, cmdContext);
      code = error.code;
      message = error.message;
      suggestion = error.suggestion;
      docsUrl = error.docsUrl;
    } else if (isAWSError(error)) {
      const parsed = parseAWSError(error);
      code = `AWS_${parsed.code}`;
      trackError(code, cmdContext, { action: parsed.action });
      // Map to user-friendly WrapsError for message/suggestion
      const wrapsErr = awsErrorToWrapsError(parsed.code, parsed.action, error);
      message = wrapsErr.message;
      suggestion = wrapsErr.suggestion;
      docsUrl = wrapsErr.docsUrl;
    } else if (isPulumiError(error)) {
      const parsed = parsePulumiError(error as Error);
      code = `PULUMI_${parsed.code}`;
      trackError(code, cmdContext, {
        iamAction: parsed.iamAction,
        service: parsed.service,
        errorType: (error as Error)?.constructor?.name,
      });
      const wrapsErr = pulumiErrorToWrapsError(
        parsed.code,
        parsed.iamAction,
        parsed.service,
        parsed.resourceName,
        parsed.resourceType,
        (error as Error)?.message
      );
      message = wrapsErr.message;
      suggestion = wrapsErr.suggestion;
      docsUrl = wrapsErr.docsUrl;
    } else {
      trackError("UNHANDLED_ERROR", cmdContext, {
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        message: sanitizeErrorMessage(error),
      });
      message =
        error instanceof Error ? error.message : String(error || message);
    }

    jsonError(cmdContext, { code, message, suggestion, docsUrl });
    process.exit(1);
  }

  console.error(""); // Blank line

  if (error instanceof WrapsError) {
    // Track error (code only, never message)
    trackError(error.code, cmdContext);

    clack.log.error(error.message);

    if (error.suggestion) {
      console.log(`\n${pc.yellow("Suggestion:")}`);
      // Format suggestion with proper indentation for multi-line
      const lines = error.suggestion.split("\n");
      for (const line of lines) {
        console.log(`  ${pc.white(line)}`);
      }
      console.log();
    }

    if (error.docsUrl) {
      console.log(`${pc.dim("Documentation:")}`);
      console.log(`  ${pc.blue(error.docsUrl)}\n`);
    }

    process.exit(1);
  }

  // Check for AWS SDK errors
  if (isAWSError(error)) {
    const { code, action } = parseAWSError(error);
    trackError(`AWS_${code}`, cmdContext, { action });

    const wrapsError = awsErrorToWrapsError(code, action, error);

    clack.log.error(wrapsError.message);
    if (wrapsError.suggestion) {
      console.log(`\n${pc.yellow("Suggestion:")}`);
      const lines = wrapsError.suggestion.split("\n");
      for (const line of lines) {
        console.log(`  ${pc.white(line)}`);
      }
      console.log();
    }
    if (wrapsError.docsUrl) {
      console.log(`${pc.dim("Documentation:")}`);
      console.log(`  ${pc.blue(wrapsError.docsUrl)}\n`);
    }
    process.exit(1);
  }

  // Check for Pulumi errors
  if (isPulumiError(error)) {
    const { code, iamAction, service, resourceName, resourceType } =
      parsePulumiError(error as Error);
    trackError(`PULUMI_${code}`, cmdContext, {
      iamAction,
      service,
      errorType: (error as Error)?.constructor?.name,
    });

    const wrapsError = pulumiErrorToWrapsError(
      code,
      iamAction,
      service,
      resourceName,
      resourceType,
      (error as Error)?.message
    );

    clack.log.error(wrapsError.message);
    if (wrapsError.suggestion) {
      console.log(`\n${pc.yellow("Suggestion:")}`);
      const lines = wrapsError.suggestion.split("\n");
      for (const line of lines) {
        console.log(`  ${pc.white(line)}`);
      }
      console.log();
    }
    if (wrapsError.docsUrl) {
      console.log(`${pc.dim("Documentation:")}`);
      console.log(`  ${pc.blue(wrapsError.docsUrl)}\n`);
    }
    process.exit(1);
  }

  // Unknown error - still track with sanitized context
  trackError("UNHANDLED_ERROR", cmdContext, {
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    message: sanitizeErrorMessage(error),
  });

  clack.log.error("An unexpected error occurred");
  if (error instanceof Error) {
    console.error(pc.dim(error.message));
  } else if (typeof error === "string") {
    console.error(error);
  }
  console.log(`\n${pc.dim("If this persists, please report at:")}`);
  console.log(`  ${pc.blue("https://github.com/wraps-team/wraps/issues")}\n`);
  process.exit(1);
}

/**
 * Convert AWS error code to a user-friendly WrapsError.
 * Extracted to share between JSON and human-readable paths.
 *
 * The default branch must NEVER lie about credentials — if the request reached
 * AWS far enough to throw a named exception, credentials are valid. Surface the
 * real error name and message so users can self-diagnose.
 */
export function awsErrorToWrapsError(
  code: string,
  action?: string,
  originalError?: unknown
): WrapsError {
  switch (code) {
    // Credential / token errors — these mean the request never reached the API
    case "ExpiredTokenException":
    case "TokenRefreshRequired":
    case "SSOTokenExpired":
      return errors.sessionTokenExpired();
    case "InvalidClientTokenId":
    case "InvalidAccessKeyId":
    case "SignatureDoesNotMatch":
    case "UnrecognizedClientException":
      return errors.accessKeyInvalid();

    // IAM permission errors — request reached AWS but was denied
    case "AccessDenied":
    case "AccessDeniedException":
    case "UnauthorizedAccess":
      return errors.iamPermissionDenied(
        action || "unknown",
        "AWS resource",
        "Ensure your IAM user/role has the required permissions."
      );

    // SES SendEmail errors — request reached SES but was rejected
    case "MessageRejected":
      return errors.sesMessageRejected(sanitizeErrorMessage(originalError));
    case "MailFromDomainNotVerifiedException":
      return errors.sesMailFromNotVerified(sanitizeErrorMessage(originalError));
    case "AccountSendingPausedException":
      return errors.sesAccountSendingPaused();
    case "ConfigurationSetSendingPausedException":
      return errors.sesConfigSetSendingPaused();
    case "ConfigurationSetDoesNotExistException":
      return errors.sesConfigSetMissing(sanitizeErrorMessage(originalError));

    // Throughput / quota errors
    case "Throttling":
    case "ThrottlingException":
    case "TooManyRequestsException":
      return errors.awsThrottled(action);
    case "LimitExceededException":
    case "ServiceQuotaExceededException":
      return errors.awsLimitExceeded(
        action,
        sanitizeErrorMessage(originalError)
      );

    // Anything else — surface the real error instead of lying about credentials
    default:
      return errors.awsUnknownError(
        code,
        action,
        sanitizeErrorMessage(originalError)
      );
  }
}

/**
 * Convert Pulumi error code to a user-friendly WrapsError.
 * Extracted to share between JSON and human-readable paths.
 */
function pulumiErrorToWrapsError(
  code: string,
  iamAction?: string,
  service?: string,
  resourceName?: string,
  resourceType?: string,
  originalMessage?: string
): WrapsError {
  switch (code) {
    case "RESOURCE_CONFLICT":
      return errors.resourceConflict(
        resourceName || "unknown resource",
        resourceType
      );
    case "STACK_LOCKED":
      return errors.stackLocked();
    case "SES_PERMISSION_DENIED":
      return errors.sesPermissionDenied(iamAction || "unknown");
    case "DYNAMODB_PERMISSION_DENIED":
      return errors.dynamoDBPermissionDenied();
    case "LAMBDA_PERMISSION_DENIED":
      return errors.lambdaPermissionDenied();
    case "EVENTBRIDGE_PERMISSION_DENIED":
      return errors.eventBridgePermissionDenied();
    case "SQS_PERMISSION_DENIED":
      return errors.sqsPermissionDenied();
    case "IAM_PERMISSION_DENIED":
      return errors.iamPermissionDenied(
        iamAction || "unknown",
        "AWS resource",
        service
          ? `Your IAM user/role needs ${service.toUpperCase()} permissions.`
          : "Ensure your IAM user/role has the required permissions."
      );
    default:
      // sanitizeErrorMessage(undefined) returns "Unknown error", which is
      // truthy, so a `||` fallback to "Deployment failed" would be dead code.
      // Use an explicit check on the input instead.
      return errors.pulumiError(
        originalMessage
          ? sanitizeErrorMessage(originalMessage)
          : "Deployment failed"
      );
  }
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

  // The accountId parameter is kept in the signature so callers don't
  // have to change, but it is deliberately not included in the output —
  // the user ran the command so they know their own account, and keeping
  // IDs out of error text matches the `sanitizeErrorMessage` posture used
  // elsewhere in the error system.
  regionRequired: (_accountId: string, savedRegions: readonly string[]) =>
    new WrapsError(
      "Region is required and could not be determined",
      "REGION_REQUIRED",
      savedRegions.length > 0
        ? `Pass --region or set AWS_REGION.\nSaved regions: ${savedRegions.join(", ")}`
        : "Pass --region or set AWS_REGION.\nNo saved Wraps deployments found.",
      "https://wraps.dev/docs/cli-reference"
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
      "This happens when a previous deployment was interrupted.\n\nFor local state, run:\n  rm -rf ~/.wraps/pulumi/.pulumi/locks\n\nFor S3 state, delete the lock object in your wraps-state-* bucket under .pulumi/locks/\n\nThen try your command again.",
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

  // Credential-specific errors
  ssoSessionExpired: (profile?: string) =>
    new WrapsError(
      `AWS SSO session has expired${profile ? ` for profile "${profile}"` : ""}`,
      "SSO_SESSION_EXPIRED",
      profile
        ? `Run: aws sso login --profile ${profile}`
        : "Run: aws sso login",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  profileNotFound: (profile: string, availableProfiles: string[]) =>
    new WrapsError(
      `AWS profile "${profile}" not found`,
      "PROFILE_NOT_FOUND",
      availableProfiles.length > 0
        ? `Available profiles: ${availableProfiles.join(", ")}\n\nSet a valid profile:\n  export AWS_PROFILE=<profile-name>\n\nOr configure a new profile:\n  aws configure --profile ${profile}`
        : "No AWS profiles configured.\n\nConfigure AWS credentials:\n  aws configure\n\nOr set up SSO:\n  aws configure sso",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  credentialsFileMissing: () =>
    new WrapsError(
      "AWS credentials file not found",
      "CREDENTIALS_FILE_MISSING",
      "Configure AWS credentials:\n  aws configure\n\nOr set environment variables:\n  export AWS_ACCESS_KEY_ID=<your-key>\n  export AWS_SECRET_ACCESS_KEY=<your-secret>",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  accessKeyInvalid: () =>
    new WrapsError(
      "AWS access key is invalid or has been deactivated",
      "ACCESS_KEY_INVALID",
      "Check your AWS access keys in the IAM console.\n\nReconfigure credentials:\n  aws configure\n\nOr generate new access keys in AWS IAM.",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  sessionTokenExpired: () =>
    new WrapsError(
      "AWS session token has expired",
      "SESSION_TOKEN_EXPIRED",
      "Your temporary credentials have expired.\n\nFor SSO users:\n  aws sso login\n\nFor assumed roles:\n  Re-run your assume-role command",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  // IAM permission errors
  iamPermissionDenied: (action: string, resource: string, suggestion: string) =>
    new WrapsError(
      `Permission denied: ${action} on ${resource}`,
      "IAM_PERMISSION_DENIED",
      `Your AWS credentials lack the "${action}" permission.\n\n${suggestion}\n\nView required permissions:\n  wraps permissions --json`,
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  sesPermissionDenied: (action: string) =>
    new WrapsError(
      `SES permission denied: ${action}`,
      "SES_PERMISSION_DENIED",
      `Your IAM user/role needs the "ses:${action}" permission.\n\nView required SES permissions:\n  wraps permissions --service email --json`,
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  // SES SendEmail rejection errors — request reached SES but the send failed
  // for a reason unrelated to credentials.
  sesMessageRejected: (detail: string) =>
    new WrapsError(
      `SES rejected the message: ${detail}`,
      "SES_MESSAGE_REJECTED",
      "Common causes:\n  • Account is in the SES sandbox and the recipient is not a verified address\n  • Sender identity (domain or email) is not verified for sending\n  • The sender domain is verified for receiving but not for sending\n\nCheck status:\n  wraps email status\n  wraps email doctor\n\nRequest production access (exit sandbox):\n  https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html",
      "https://wraps.dev/docs/guides/aws-setup/troubleshooting"
    ),

  sesMailFromNotVerified: (detail: string) =>
    new WrapsError(
      `SES MAIL FROM domain is not verified: ${detail}`,
      "SES_MAIL_FROM_NOT_VERIFIED",
      "The custom MAIL FROM domain configured for this identity is not fully verified.\n\nCheck DNS records:\n  wraps email verify\n\nOr remove the custom MAIL FROM domain in the SES console and retry.",
      "https://docs.aws.amazon.com/ses/latest/dg/mail-from.html"
    ),

  sesAccountSendingPaused: () =>
    new WrapsError(
      "SES account-level sending is paused",
      "SES_ACCOUNT_SENDING_PAUSED",
      "Your SES account is currently paused from sending email. This is usually caused by:\n  • A high bounce or complaint rate\n  • An AWS-initiated review\n\nCheck the SES console → Reputation Dashboard for details, then resume sending once the issue is resolved.",
      "https://docs.aws.amazon.com/ses/latest/dg/reputationdashboard.html"
    ),

  sesConfigSetSendingPaused: () =>
    new WrapsError(
      "SES configuration set sending is paused",
      "SES_CONFIG_SET_SENDING_PAUSED",
      "The configuration set used for this send has sending paused. Resume it in the SES console under Configuration Sets, or send without specifying the paused configuration set.",
      "https://docs.aws.amazon.com/ses/latest/dg/using-configuration-sets.html"
    ),

  sesConfigSetMissing: (detail: string) =>
    new WrapsError(
      `SES configuration set does not exist: ${detail}`,
      "SES_CONFIG_SET_MISSING",
      "The configuration set referenced by this send does not exist in the current region. Create it in the SES console, switch regions, or remove the ConfigurationSetName from the request.",
      "https://docs.aws.amazon.com/ses/latest/dg/using-configuration-sets.html"
    ),

  // Generic AWS error fallbacks — used by awsErrorToWrapsError when no specific
  // mapping exists. These NEVER claim credentials are missing.
  awsThrottled: (action?: string) =>
    new WrapsError(
      `AWS request was throttled${action ? ` (${action})` : ""}`,
      "AWS_THROTTLED",
      "AWS is rate-limiting requests to this API. Wait a moment and retry.\n\nIf this happens repeatedly, request a service quota increase in the AWS console.",
      "https://docs.aws.amazon.com/general/latest/gr/api-retries.html"
    ),

  awsLimitExceeded: (action?: string, detail?: string) =>
    new WrapsError(
      `AWS service limit exceeded${action ? ` (${action})` : ""}${detail ? `: ${detail}` : ""}`,
      "AWS_LIMIT_EXCEEDED",
      "You've hit a service quota for this AWS API.\n\nRequest a quota increase in the AWS console:\n  Service Quotas → AWS Services → (your service)",
      "https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html"
    ),

  awsUnknownError: (code: string, action?: string, detail?: string) =>
    new WrapsError(
      `AWS API error: ${code}${action ? ` (${action})` : ""}${detail ? ` — ${detail}` : ""}`,
      `AWS_${code}`,
      `This is an AWS API error, not a credentials problem. Look up "${code}" in the AWS documentation for the failing service.\n\nIf you believe this is a Wraps bug, report it at:\n  https://github.com/wraps-team/wraps/issues`,
      "https://wraps.dev/docs/guides/aws-setup/troubleshooting"
    ),

  dynamoDBPermissionDenied: () =>
    new WrapsError(
      "DynamoDB permission denied",
      "DYNAMODB_PERMISSION_DENIED",
      "Your IAM user/role needs DynamoDB permissions.\nRequired actions: CreateTable, DeleteTable, DescribeTable, UpdateTable\n\nView required permissions:\n  wraps permissions --json",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  lambdaPermissionDenied: () =>
    new WrapsError(
      "Lambda permission denied",
      "LAMBDA_PERMISSION_DENIED",
      "Your IAM user/role needs Lambda permissions.\nRequired actions: CreateFunction, UpdateFunctionCode, DeleteFunction\n\nView required permissions:\n  wraps permissions --json",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  eventBridgePermissionDenied: () =>
    new WrapsError(
      "EventBridge permission denied",
      "EVENTBRIDGE_PERMISSION_DENIED",
      "Your IAM user/role needs EventBridge permissions.\nRequired actions: PutRule, PutTargets, DeleteRule\n\nView required permissions:\n  wraps permissions --json",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  sqsPermissionDenied: () =>
    new WrapsError(
      "SQS permission denied",
      "SQS_PERMISSION_DENIED",
      "Your IAM user/role needs SQS permissions.\nRequired actions: CreateQueue, DeleteQueue, GetQueueAttributes\n\nView required permissions:\n  wraps permissions --json",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  route53PermissionDenied: () =>
    new WrapsError(
      "Route53 permission denied",
      "ROUTE53_PERMISSION_DENIED",
      "Your IAM user/role needs Route53 permissions for automatic DNS management.\nRequired actions: ChangeResourceRecordSets, ListHostedZones\n\nThis is optional - you can add DNS records manually instead.",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  s3StateBucketCreationFailed: (bucketName: string) =>
    new WrapsError(
      `Failed to create S3 state bucket: ${bucketName}`,
      "S3_STATE_BUCKET_CREATION_FAILED",
      "Ensure your IAM user/role has s3:CreateBucket, s3:PutBucketEncryption, s3:PutBucketVersioning permissions.\n\nTo use local-only state instead:\n  export WRAPS_LOCAL_ONLY=1",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  inboundRegionNotSupported: (region: string) =>
    new WrapsError(
      `SES email receiving is not supported in ${region}`,
      "INBOUND_REGION_NOT_SUPPORTED",
      "SES receipt rules are only available in:\n  us-east-1 (N. Virginia)\n  us-west-2 (Oregon)\n  eu-west-1 (Ireland)\n\nDeploy email infrastructure in one of these regions to enable inbound email.",
      "https://docs.aws.amazon.com/ses/latest/dg/regions.html#region-receive-email"
    ),

  inboundRequiresOutbound: () =>
    new WrapsError(
      "Inbound email requires outbound email infrastructure",
      "INBOUND_REQUIRES_OUTBOUND",
      "Deploy email infrastructure first:\n  wraps email init\n\nThen enable inbound email:\n  wraps email inbound init",
      "https://wraps.dev/docs/quickstart/email"
    ),

  receiptRuleSetConflict: (activeRuleSet: string) =>
    new WrapsError(
      `Another receipt rule set is active: ${activeRuleSet}`,
      "RECEIPT_RULE_SET_CONFLICT",
      `SES only allows one active receipt rule set at a time.\nCurrently active: "${activeRuleSet}"\n\nWraps will activate "wraps-inbound-rules" which will deactivate the current set.\nYou may need to merge your existing rules into the wraps rule set.`,
      "https://docs.aws.amazon.com/ses/latest/dg/receiving-email-concepts.html"
    ),

  s3StateAccessDenied: () =>
    new WrapsError(
      "Access denied to S3 state bucket",
      "S3_STATE_ACCESS_DENIED",
      "Ensure your IAM user/role has s3:GetObject, s3:PutObject, s3:ListBucket permissions on wraps-state-* buckets.\n\nTo use local-only state instead:\n  export WRAPS_LOCAL_ONLY=1",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  stateMigrationFailed: () =>
    new WrapsError(
      "Failed to migrate Pulumi state to S3",
      "STATE_MIGRATION_FAILED",
      "The migration from local to S3 state storage failed.\nYour local state is still intact.\n\nTo skip migration and use local-only state:\n  export WRAPS_LOCAL_ONLY=1",
      "https://wraps.dev/docs/guides/aws-setup/permissions"
    ),

  resourceConflict: (resourceName: string, resourceType?: string) =>
    new WrapsError(
      `Resource already exists: ${resourceName}${resourceType ? ` (${resourceType})` : ""}`,
      "RESOURCE_CONFLICT",
      "Existing Wraps resources were found in your AWS account.\n\nTo diagnose and clean up:\n  wraps email doctor --cleanup\n\nThen retry your deployment.",
      "https://wraps.dev/docs/guides/aws-setup/troubleshooting"
    ),

  // Templates-as-code errors
  wrapsConfigNotFound: () =>
    new WrapsError(
      "wraps/wraps.config.ts not found",
      "WRAPS_CONFIG_NOT_FOUND",
      "Initialize templates first:\n  wraps email templates init",
      "https://wraps.dev/docs/guides/templates"
    ),

  templateCompilationFailed: (name: string, error: string) =>
    new WrapsError(
      `Failed to compile template "${name}": ${error}`,
      "TEMPLATE_COMPILATION_FAILED",
      "Check your template for syntax errors and ensure all imports are valid.",
      "https://wraps.dev/docs/guides/templates"
    ),

  notAuthenticated: () =>
    new WrapsError(
      "Not authenticated to Wraps Platform",
      "NOT_AUTHENTICATED",
      "Sign in first:\n  wraps auth login\n\nOr provide an API key:\n  wraps push --token wraps_...\n  WRAPS_API_KEY=wraps_... wraps push",
      "https://wraps.dev/docs/cli-reference/auth"
    ),

  templatePushFailed: (name: string, error: string) =>
    new WrapsError(
      `Failed to push template "${name}": ${error}`,
      "TEMPLATE_PUSH_FAILED",
      "Check your API key and network connection.",
      "https://wraps.dev/docs/guides/templates"
    ),
};
