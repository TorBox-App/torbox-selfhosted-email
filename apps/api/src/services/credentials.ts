/**
 * AWS Credentials Service
 *
 * Uses STS AssumeRole to get temporary credentials for customer AWS accounts.
 * Reuses credential patterns from apps/web.
 */

import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { and, awsAccount, db, eq } from "@wraps/db";

import { awsDefaults } from "../lib/aws-defaults";

const stsClient = new STSClient(awsDefaults);

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
  region: string;
};

// Cache credentials by account ID
const credentialCache = new Map<
  string,
  { credentials: AwsCredentials; expiresAt: number }
>();

export async function getCredentials(
  awsAccountId: string,
  organizationId: string
): Promise<AwsCredentials> {
  // Check cache first (keyed by both account + org to prevent cross-tenant cache hits)
  const cacheKey = `${awsAccountId}:${organizationId}`;
  const cached = credentialCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    // 1 minute buffer
    return cached.credentials;
  }

  // Look up AWS account to get role ARN and region (scoped by org)
  const [account] = await db
    .select({
      roleArn: awsAccount.roleArn,
      externalId: awsAccount.externalId,
      region: awsAccount.region,
    })
    .from(awsAccount)
    .where(
      and(
        eq(awsAccount.id, awsAccountId),
        eq(awsAccount.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!account?.roleArn) {
    throw new Error(`AWS account ${awsAccountId} not found or not configured`);
  }

  // Assume role
  const result = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: account.roleArn,
      RoleSessionName: `wraps-api-${Date.now()}`,
      ExternalId: account.externalId ?? undefined,
      DurationSeconds: 3600, // 1 hour
    })
  );

  if (!result.Credentials) {
    throw new Error("Failed to assume role");
  }

  const credentials: AwsCredentials = {
    accessKeyId: result.Credentials.AccessKeyId!,
    secretAccessKey: result.Credentials.SecretAccessKey!,
    sessionToken: result.Credentials.SessionToken!,
    expiration: result.Credentials.Expiration!,
    region: account.region,
  };

  // Cache credentials
  credentialCache.set(cacheKey, {
    credentials,
    expiresAt: credentials.expiration.getTime(),
  });

  return credentials;
}

/**
 * Assume a role using raw ARN + external ID (for validating new connections).
 * Unlike getCredentials(), this doesn't look up from DB — it's for pre-registration validation.
 */
export async function assumeRoleForValidation(params: {
  roleArn: string;
  externalId: string;
  region: string;
}): Promise<AwsCredentials> {
  const result = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: params.roleArn,
      RoleSessionName: `wraps-connection-validation-${Date.now()}`,
      ExternalId: params.externalId,
      DurationSeconds: 900,
    })
  );

  if (!result.Credentials) {
    throw new Error("Failed to assume role: no credentials returned");
  }

  return {
    accessKeyId: result.Credentials.AccessKeyId!,
    secretAccessKey: result.Credentials.SecretAccessKey!,
    sessionToken: result.Credentials.SessionToken!,
    expiration: result.Credentials.Expiration!,
    region: params.region,
  };
}
