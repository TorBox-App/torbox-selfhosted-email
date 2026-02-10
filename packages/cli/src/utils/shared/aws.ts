import { ACMClient, DescribeCertificateCommand } from "@aws-sdk/client-acm";
import {
  GetIdentityVerificationAttributesCommand,
  ListIdentitiesCommand,
  SESClient,
} from "@aws-sdk/client-ses";
import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import {
  type AWSSetupState,
  detectAWSState,
  getConfiguredProfiles,
  getCurrentProfile,
  getSSOLoginCommand,
} from "./aws-detection.js";
import { errors } from "./errors.js";

/**
 * AWS identity information
 */
export type AWSIdentity = {
  accountId: string;
  userId: string;
  arn: string;
};

/**
 * Result of credential validation with additional context
 */
export type CredentialValidationResult = {
  /** AWS identity information */
  identity: AWSIdentity;
  /** Source of credentials (profile, environment, sso, instance) */
  credentialSource: AWSSetupState["credentialSource"];
  /** Warnings about credential state (e.g., SSO expiring soon) */
  warnings: string[];
};

/**
 * Validate AWS credentials with detailed error handling
 * Uses detectAWSState() for comprehensive environment detection
 * Maps specific errors to actionable WrapsError types
 */
export async function validateAWSCredentials(): Promise<AWSIdentity> {
  const result = await validateAWSCredentialsWithDetails();
  return result.identity;
}

/**
 * Validate AWS credentials and return detailed result with warnings
 * Provides additional context about credential state for better UX
 */
export async function validateAWSCredentialsWithDetails(): Promise<CredentialValidationResult> {
  // Get comprehensive AWS state
  const state = await detectAWSState();
  const warnings: string[] = [];

  // Check if SSO is configured but token is expired
  if (state.sso.configured && state.sso.tokenStatus?.expired) {
    const profile = state.sso.activeProfile?.name;
    throw errors.ssoSessionExpired(profile);
  }

  // Check if SSO token is about to expire (within 15 minutes)
  if (
    state.sso.configured &&
    state.sso.tokenStatus?.valid &&
    state.sso.tokenStatus.minutesRemaining !== null &&
    state.sso.tokenStatus.minutesRemaining < 15
  ) {
    const minutes = state.sso.tokenStatus.minutesRemaining;
    const loginCmd = getSSOLoginCommand(state.sso.activeProfile?.name);
    warnings.push(
      `SSO session expires in ${minutes} minute${minutes !== 1 ? "s" : ""}. Run "${loginCmd}" to refresh.`
    );
  }

  // Check if specified profile exists
  const currentProfile = getCurrentProfile();
  if (currentProfile && currentProfile !== "default") {
    const availableProfiles = getConfiguredProfiles();
    if (!availableProfiles.includes(currentProfile)) {
      throw errors.profileNotFound(currentProfile, availableProfiles);
    }
  }

  // Try to validate credentials with STS
  const sts = new STSClient({ region: "us-east-1" });

  try {
    const identity = await sts.send(new GetCallerIdentityCommand({}));

    return {
      identity: {
        accountId: identity.Account!,
        userId: identity.UserId!,
        arn: identity.Arn!,
      },
      credentialSource: state.credentialSource,
      warnings,
    };
  } catch (error: unknown) {
    // Map specific AWS errors to our error types
    if (error instanceof Error) {
      switch (error.name) {
        case "ExpiredTokenException":
        case "TokenRefreshRequired":
          throw errors.sessionTokenExpired();

        case "InvalidClientTokenId":
        case "InvalidAccessKeyId":
        case "SignatureDoesNotMatch":
          throw errors.accessKeyInvalid();

        case "CredentialsError":
        case "CredentialsProviderError":
          // Check if credentials file is missing
          if (error.message?.includes("Could not load credentials")) {
            throw errors.credentialsFileMissing();
          }
          break;

        case "UnrecognizedClientException":
          throw errors.accessKeyInvalid();
      }
    }

    // Default to generic credentials error
    throw errors.noAWSCredentials();
  }
}

/**
 * Check if a region is valid
 */
export async function checkRegion(region: string): Promise<boolean> {
  // List of valid AWS regions (as of 2025)
  const validRegions = [
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "af-south-1",
    "ap-east-1",
    "ap-south-1",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-northeast-3",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-southeast-3",
    "ca-central-1",
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "eu-south-1",
    "eu-north-1",
    "me-south-1",
    "sa-east-1",
  ];

  return validRegions.includes(region);
}

/**
 * Get AWS region from environment or config
 */
export async function getAWSRegion(): Promise<string> {
  // Try to detect region from various sources
  if (process.env.AWS_REGION) {
    return process.env.AWS_REGION;
  }
  if (process.env.AWS_DEFAULT_REGION) {
    return process.env.AWS_DEFAULT_REGION;
  }

  // Default fallback
  return "us-east-1";
}

/**
 * SES domain identity
 */
export type SESDomain = {
  domain: string;
  verified: boolean;
};

/**
 * List all SES identities (domains) in the account
 */
export async function listSESDomains(region: string): Promise<SESDomain[]> {
  const ses = new SESClient({ region });

  try {
    // Get all identities
    const identitiesResponse = await ses.send(
      new ListIdentitiesCommand({
        IdentityType: "Domain",
      })
    );

    const identities = identitiesResponse.Identities || [];

    if (identities.length === 0) {
      return [];
    }

    // Get verification attributes
    const attributesResponse = await ses.send(
      new GetIdentityVerificationAttributesCommand({
        Identities: identities,
      })
    );

    const attributes = attributesResponse.VerificationAttributes || {};

    // Map to SESDomain objects
    return identities.map((domain) => ({
      domain,
      verified: attributes[domain]?.VerificationStatus === "Success",
    }));
  } catch {
    // guardrail:allow-swallowed-error — listing SES domains may fail due to permissions, safe to return empty
    return [];
  }
}

/**
 * SES account status including sandbox mode and send quota
 */
export type SESAccountStatus = {
  isSandbox: boolean;
  sandboxUncertain?: boolean;
  sendQuota?: {
    max24HourSend: number;
    maxSendRate: number;
    sentLast24Hours: number;
  };
  enforcementStatus?: string;
};

/**
 * Get SES account status including sandbox mode detection
 * Uses SESv2 GetAccountCommand to check ProductionAccessEnabled
 */
export async function getSESAccountStatus(
  region: string
): Promise<SESAccountStatus> {
  const sesv2 = new SESv2Client({ region });

  try {
    const response = await sesv2.send(new GetAccountCommand({}));
    return {
      isSandbox: !response.ProductionAccessEnabled,
      sendQuota: response.SendQuota
        ? {
            max24HourSend: response.SendQuota.Max24HourSend ?? 0,
            maxSendRate: response.SendQuota.MaxSendRate ?? 0,
            sentLast24Hours: response.SendQuota.SentLast24Hours ?? 0,
          }
        : undefined,
      enforcementStatus: response.EnforcementStatus,
    };
  } catch {
    // guardrail:allow-swallowed-error — SES GetAccount may fail due to permissions or throttling, default to sandbox (safer: offers extra help)
    return { isSandbox: true, sandboxUncertain: true };
  }
}

/**
 * Check if SES is in sandbox mode
 */
export async function isSESSandbox(region: string): Promise<boolean> {
  const status = await getSESAccountStatus(region);
  return status.isSandbox;
}

/**
 * ACM certificate status
 */
export type ACMCertificateStatus = {
  status: string;
  domainName: string;
  validationRecords: Array<{
    name: string;
    type: string;
    value: string;
  }>;
};

/**
 * Check ACM certificate validation status
 * Note: ACM certificates for CloudFront must be in us-east-1
 */
export async function getACMCertificateStatus(
  certificateArn: string
): Promise<ACMCertificateStatus | null> {
  const acm = new ACMClient({ region: "us-east-1" });

  try {
    const response = await acm.send(
      new DescribeCertificateCommand({
        CertificateArn: certificateArn,
      })
    );

    const certificate = response.Certificate;
    if (!certificate) {
      return null;
    }

    // Extract validation records
    const validationRecords =
      certificate.DomainValidationOptions?.map((option) => ({
        name: option.ResourceRecord?.Name || "",
        type: option.ResourceRecord?.Type || "",
        value: option.ResourceRecord?.Value || "",
      })) || [];

    return {
      status: certificate.Status || "UNKNOWN",
      domainName: certificate.DomainName || "",
      validationRecords,
    };
  } catch (error) {
    console.error("Error getting ACM certificate status:", error);
    return null;
  }
}
