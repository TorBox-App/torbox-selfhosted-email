/**
 * AWS environment detection utilities
 * @module utils/shared/aws-detection
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

/**
 * SSO Profile configuration from ~/.aws/config
 */
export type SSOProfile = {
  /** Profile name */
  name: string;
  /** SSO start URL (e.g., https://myorg.awsapps.com/start) */
  ssoStartUrl: string;
  /** SSO region (e.g., us-east-1) */
  ssoRegion: string;
  /** AWS account ID to assume */
  ssoAccountId: string;
  /** IAM role name to assume */
  ssoRoleName: string;
  /** Default region for this profile */
  region?: string;
  /** SSO session name (for named sessions) */
  ssoSession?: string;
};

/**
 * SSO Session configuration (for aws configure sso-session)
 */
export type SSOSession = {
  /** Session name */
  name: string;
  /** SSO start URL */
  ssoStartUrl: string;
  /** SSO region */
  ssoRegion: string;
  /** Registration scopes */
  ssoRegistrationScopes?: string[];
};

/**
 * SSO token status
 */
export type SSOTokenStatus = {
  /** Whether a valid token exists */
  valid: boolean;
  /** When the token expires (if valid) */
  expiresAt: Date | null;
  /** Whether the token is expired */
  expired: boolean;
  /** Minutes until expiry (negative if expired) */
  minutesRemaining: number | null;
  /** The SSO start URL this token is for */
  startUrl: string | null;
};

/**
 * AWS setup state representing current environment configuration
 */
export type AWSSetupState = {
  /** Whether AWS CLI is installed */
  cliInstalled: boolean;
  /** AWS CLI version if installed */
  cliVersion: string | null;
  /** Whether credentials are configured and working */
  credentialsConfigured: boolean;
  /** Source of credentials (profile, environment, sso, instance) */
  credentialSource: "profile" | "environment" | "sso" | "instance" | null;
  /** AWS profile name if using profile-based credentials */
  profileName: string | null;
  /** AWS account ID if credentials are valid */
  accountId: string | null;
  /** Detected hosting provider based on environment */
  detectedProvider: "vercel" | "aws" | "railway" | "netlify" | null;
  /** Current AWS region from environment */
  region: string | null;
  /** SSO-specific information */
  sso: {
    /** Whether SSO is configured */
    configured: boolean;
    /** Available SSO profiles */
    profiles: SSOProfile[];
    /** SSO sessions (named sessions from aws configure sso-session) */
    sessions: SSOSession[];
    /** Current SSO token status */
    tokenStatus: SSOTokenStatus | null;
    /** Currently active SSO profile (if using SSO) */
    activeProfile: SSOProfile | null;
  };
};

/**
 * Check if AWS CLI is installed by running `aws --version`
 */
export async function isAWSCLIInstalled(): Promise<boolean> {
  try {
    execSync("aws --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get AWS CLI version
 * @returns Version string (e.g., "2.15.0") or null if not installed
 */
export async function getAWSCLIVersion(): Promise<string | null> {
  try {
    const output = execSync("aws --version", { encoding: "utf-8" });
    // Output format: "aws-cli/2.15.0 Python/3.11.6 Darwin/23.0.0 source/arm64"
    const match = output.match(/aws-cli\/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Detect credential source from environment
 */
export function detectCredentialSource():
  | "profile"
  | "environment"
  | "sso"
  | "instance"
  | null {
  // Check for explicit environment variables (highest priority)
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return "environment";
  }

  // Check for SSO session
  if (process.env.AWS_SSO_ACCOUNT_ID || process.env.AWS_SSO_SESSION) {
    return "sso";
  }

  // Check for profile
  if (process.env.AWS_PROFILE) {
    return "profile";
  }

  // Check for default credentials file
  const credentialsPath = join(homedir(), ".aws", "credentials");
  if (existsSync(credentialsPath)) {
    const content = readFileSync(credentialsPath, "utf-8");
    if (content.includes("[default]")) {
      return "profile";
    }
  }

  // Check for SSO cache (indicates SSO login)
  const ssoCachePath = join(homedir(), ".aws", "sso", "cache");
  if (existsSync(ssoCachePath)) {
    return "sso";
  }

  // Check for instance metadata (EC2, ECS, Lambda)
  if (
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_EXECUTION_ENV
  ) {
    return "instance";
  }

  return null;
}

/**
 * Detect hosting provider from environment variables
 */
export function detectHostingProvider():
  | "vercel"
  | "aws"
  | "railway"
  | "netlify"
  | null {
  // Vercel
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return "vercel";
  }

  // Railway
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
    return "railway";
  }

  // Netlify
  if (process.env.NETLIFY || process.env.NETLIFY_DEV) {
    return "netlify";
  }

  // AWS (Lambda, ECS, EC2)
  if (
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.ECS_CONTAINER_METADATA_URI ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
  ) {
    return "aws";
  }

  return null;
}

/**
 * Validate AWS credentials by calling STS GetCallerIdentity
 * @returns Account ID if valid, null if invalid/not configured
 */
export async function validateCredentials(): Promise<string | null> {
  try {
    const sts = new STSClient({ region: "us-east-1" });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return identity.Account || null;
  } catch {
    return null;
  }
}

/**
 * Get current AWS profile name
 */
export function getCurrentProfile(): string | null {
  return process.env.AWS_PROFILE || "default";
}

/**
 * Get current AWS region from environment or config
 */
export function getCurrentRegion(): string | null {
  // Check environment variables first
  if (process.env.AWS_REGION) {
    return process.env.AWS_REGION;
  }
  if (process.env.AWS_DEFAULT_REGION) {
    return process.env.AWS_DEFAULT_REGION;
  }

  // Use AWS CLI to get configured region (handles profiles, config file, etc.)
  try {
    const region = execSync("aws configure get region", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return region || null;
  } catch {
    return null;
  }
}

/**
 * Parse AWS config file and extract SSO profiles
 * Resolves sso_session references to get start URL and region
 */
export function parseSSOProfiles(): SSOProfile[] {
  const configPath = join(homedir(), ".aws", "config");
  if (!existsSync(configPath)) {
    return [];
  }

  const content = readFileSync(configPath, "utf-8");
  const profiles: SSOProfile[] = [];

  // First, parse all sso-session blocks into a map for lookup
  const sessionMap = new Map<string, { startUrl: string; region: string }>();
  const sessionSections = content.split(/^\[/m).filter(Boolean);

  for (const section of sessionSections) {
    const lines = section.split("\n");
    const header = lines[0]?.replace("]", "").trim();

    if (header?.startsWith("sso-session ")) {
      const sessionName = header.replace("sso-session ", "");
      const config: Record<string, string> = {};

      for (const line of lines.slice(1)) {
        const match = line.match(/^\s*([^=\s]+)\s*=\s*(.+?)\s*$/);
        if (match) {
          config[match[1]] = match[2];
        }
      }

      sessionMap.set(sessionName, {
        startUrl: config.sso_start_url || "",
        region: config.sso_region || "",
      });
    }
  }

  // Now parse profile sections
  const sections = content.split(/^\[/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    const header = lines[0]?.replace("]", "").trim();

    // Skip non-profile sections
    if (!header?.startsWith("profile ") && header !== "default") {
      continue;
    }

    const profileName =
      header === "default" ? "default" : header.replace("profile ", "");

    // Parse key-value pairs
    const config: Record<string, string> = {};
    for (const line of lines.slice(1)) {
      const match = line.match(/^\s*([^=\s]+)\s*=\s*(.+?)\s*$/);
      if (match) {
        config[match[1]] = match[2];
      }
    }

    // Check if this is an SSO profile
    if (config.sso_start_url || config.sso_session) {
      // Resolve session reference if present
      let ssoStartUrl = config.sso_start_url || "";
      let ssoRegion = config.sso_region || "";

      if (config.sso_session) {
        const session = sessionMap.get(config.sso_session);
        if (session) {
          ssoStartUrl = ssoStartUrl || session.startUrl;
          ssoRegion = ssoRegion || session.region;
        }
      }

      profiles.push({
        name: profileName,
        ssoStartUrl,
        ssoRegion,
        ssoAccountId: config.sso_account_id || "",
        ssoRoleName: config.sso_role_name || "",
        region: config.region,
        ssoSession: config.sso_session,
      });
    }
  }

  return profiles;
}

/**
 * Parse SSO sessions from AWS config
 */
export function parseSSOSessions(): SSOSession[] {
  const configPath = join(homedir(), ".aws", "config");
  if (!existsSync(configPath)) {
    return [];
  }

  const content = readFileSync(configPath, "utf-8");
  const sessions: SSOSession[] = [];

  // Split into sections
  const sections = content.split(/^\[/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    const header = lines[0]?.replace("]", "").trim();

    // Only look for sso-session sections
    if (!header?.startsWith("sso-session ")) {
      continue;
    }

    const sessionName = header.replace("sso-session ", "");

    // Parse key-value pairs
    const config: Record<string, string> = {};
    for (const line of lines.slice(1)) {
      const match = line.match(/^\s*([^=\s]+)\s*=\s*(.+?)\s*$/);
      if (match) {
        config[match[1]] = match[2];
      }
    }

    sessions.push({
      name: sessionName,
      ssoStartUrl: config.sso_start_url || "",
      ssoRegion: config.sso_region || "",
      ssoRegistrationScopes: config.sso_registration_scopes
        ?.split(",")
        .map((s) => s.trim()),
    });
  }

  return sessions;
}

/**
 * Check SSO token status by examining the SSO cache
 */
export function checkSSOTokenStatus(startUrl?: string): SSOTokenStatus {
  const ssoCachePath = join(homedir(), ".aws", "sso", "cache");

  if (!existsSync(ssoCachePath)) {
    return {
      valid: false,
      expiresAt: null,
      expired: true,
      minutesRemaining: null,
      startUrl: null,
    };
  }

  try {
    const cacheFiles = readdirSync(ssoCachePath).filter((f) =>
      f.endsWith(".json")
    );

    for (const file of cacheFiles) {
      const content = readFileSync(join(ssoCachePath, file), "utf-8");
      const token = JSON.parse(content);

      // Skip if this is not an access token
      if (!(token.accessToken && token.expiresAt)) {
        continue;
      }

      // If startUrl is specified, filter by it
      if (startUrl && token.startUrl !== startUrl) {
        continue;
      }

      const expiresAt = new Date(token.expiresAt);
      const now = new Date();
      const expired = expiresAt <= now;
      const minutesRemaining = Math.floor(
        (expiresAt.getTime() - now.getTime()) / 60_000
      );

      return {
        valid: !expired,
        expiresAt,
        expired,
        minutesRemaining,
        startUrl: token.startUrl || null,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return {
    valid: false,
    expiresAt: null,
    expired: true,
    minutesRemaining: null,
    startUrl: null,
  };
}

/**
 * Get the currently active SSO profile based on AWS_PROFILE
 */
export function getActiveSSOProfile(profiles: SSOProfile[]): SSOProfile | null {
  const currentProfile = process.env.AWS_PROFILE || "default";
  return profiles.find((p) => p.name === currentProfile) || null;
}

/**
 * Check if any SSO profile is configured
 */
export function hasSSOConfigured(): boolean {
  const profiles = parseSSOProfiles();
  return profiles.length > 0;
}

/**
 * Get SSO login command for a profile
 */
export function getSSOLoginCommand(profile?: string): string {
  if (profile && profile !== "default") {
    return `aws sso login --profile ${profile}`;
  }
  return "aws sso login";
}

/**
 * Format SSO profile for display
 */
export function formatSSOProfile(profile: SSOProfile): string {
  return `${profile.name} (${profile.ssoAccountId} / ${profile.ssoRoleName})`;
}

/**
 * Detect complete AWS setup state
 * This is the main function for understanding the current AWS environment
 */
export async function detectAWSState(): Promise<AWSSetupState> {
  const [cliInstalled, cliVersion, accountId] = await Promise.all([
    isAWSCLIInstalled(),
    getAWSCLIVersion(),
    validateCredentials(),
  ]);

  const credentialSource = detectCredentialSource();
  const detectedProvider = detectHostingProvider();
  const region = getCurrentRegion();
  const profileName = getCurrentProfile();

  // Parse SSO configuration
  const ssoProfiles = parseSSOProfiles();
  const ssoSessions = parseSSOSessions();
  const activeProfile = getActiveSSOProfile(ssoProfiles);

  // Check SSO token status (use active profile's start URL if available)
  const tokenStatus =
    ssoProfiles.length > 0
      ? checkSSOTokenStatus(activeProfile?.ssoStartUrl)
      : null;

  // Determine if we're using SSO
  const isUsingSSO =
    credentialSource === "sso" ||
    (activeProfile !== null && accountId !== null);

  return {
    cliInstalled,
    cliVersion,
    credentialsConfigured: accountId !== null,
    credentialSource: isUsingSSO
      ? "sso"
      : accountId !== null
        ? credentialSource
        : null,
    profileName,
    accountId,
    detectedProvider,
    region,
    sso: {
      configured: ssoProfiles.length > 0,
      profiles: ssoProfiles,
      sessions: ssoSessions,
      tokenStatus,
      activeProfile: isUsingSSO ? activeProfile : null,
    },
  };
}

/**
 * Check if credentials file exists
 */
export function hasCredentialsFile(): boolean {
  const credentialsPath = join(homedir(), ".aws", "credentials");
  return existsSync(credentialsPath);
}

/**
 * Check if config file exists
 */
export function hasConfigFile(): boolean {
  const configPath = join(homedir(), ".aws", "config");
  return existsSync(configPath);
}

/**
 * Get list of configured profiles from AWS config
 */
export function getConfiguredProfiles(): string[] {
  const profiles: string[] = [];

  // Check credentials file
  const credentialsPath = join(homedir(), ".aws", "credentials");
  if (existsSync(credentialsPath)) {
    const content = readFileSync(credentialsPath, "utf-8");
    const matches = content.matchAll(/\[([^\]]+)\]/g);
    for (const match of matches) {
      profiles.push(match[1]);
    }
  }

  // Check config file for SSO profiles
  const configPath = join(homedir(), ".aws", "config");
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, "utf-8");
    const matches = content.matchAll(/\[profile ([^\]]+)\]/g);
    for (const match of matches) {
      if (!profiles.includes(match[1])) {
        profiles.push(match[1]);
      }
    }
  }

  return profiles;
}

/**
 * Format AWS state for display
 */
export function formatAWSState(state: AWSSetupState): string[] {
  const lines: string[] = [];

  // CLI status
  if (state.cliInstalled) {
    lines.push(`AWS CLI: v${state.cliVersion || "unknown"} installed`);
  } else {
    lines.push("AWS CLI: not installed");
  }

  // Credentials status
  if (state.credentialsConfigured) {
    const source = state.credentialSource || "unknown";
    const profile =
      state.profileName && state.profileName !== "default"
        ? ` (${state.profileName})`
        : "";
    lines.push(`Credentials: configured via ${source}${profile}`);
    lines.push(`Account: ${state.accountId}`);
  } else {
    lines.push("Credentials: not configured");
  }

  // Region
  if (state.region) {
    lines.push(`Region: ${state.region}`);
  } else {
    lines.push("Region: not set (will default to us-east-1)");
  }

  // Provider detection
  if (state.detectedProvider) {
    lines.push(`Detected provider: ${state.detectedProvider}`);
  }

  return lines;
}
