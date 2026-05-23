import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Provider } from "../../types/index.js";
import { roleExists } from "./resource-checks.js";

/**
 * Configuration for creating a service IAM role.
 */
export type ServiceIAMRoleConfig = {
  /** Service name used in resource naming (e.g. "email", "sms", "cdn") */
  serviceName: string;
  /** Hosting provider */
  provider: Provider;
  /** OIDC provider for Vercel */
  oidcProvider?: aws.iam.OpenIdConnectProvider;
  /** Vercel team slug */
  vercelTeamSlug?: string;
  /** Vercel project name */
  vercelProjectName?: string;
  /** Additional service principals for the Vercel OIDC assume-role policy (e.g. ["lambda.amazonaws.com"]) */
  additionalVercelPrincipals?: string[];
  /** Policy statements to attach. Accepts plain array or pulumi.Output for CDN-style resolved statements. */
  policyStatements: any[] | pulumi.Output<any[]>;
  /** Extra tags beyond ManagedBy and Provider */
  extraTags?: Record<string, string>;
  /** Custom Pulumi resource timeouts */
  customTimeouts?: { create?: string; update?: string; delete?: string };
};

/**
 * Create a service IAM role with assume-role policy, existence check, and attached policy.
 *
 * Shared across email, SMS, and CDN stacks to eliminate duplicated boilerplate.
 */
export async function createServiceIAMRole(
  config: ServiceIAMRoleConfig
): Promise<aws.iam.Role> {
  // Build assume role policy based on provider
  let assumeRolePolicy: pulumi.Output<string>;

  if (config.provider === "vercel" && config.oidcProvider) {
    const hasAdditionalPrincipals =
      config.additionalVercelPrincipals &&
      config.additionalVercelPrincipals.length > 0;

    if (hasAdditionalPrincipals) {
      // Multiple statements: OIDC + service principals
      const serviceStatement = JSON.stringify({
        Effect: "Allow",
        Principal: {
          Service:
            config.additionalVercelPrincipals?.length === 1
              ? config.additionalVercelPrincipals?.[0]
              : config.additionalVercelPrincipals,
        },
        Action: "sts:AssumeRole",
      });

      assumeRolePolicy = pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Federated": "${config.oidcProvider.arn}"
          },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringEquals": {
              "oidc.vercel.com/${config.vercelTeamSlug}:aud": "https://vercel.com/${config.vercelTeamSlug}"
            },
            "StringLike": {
              "oidc.vercel.com/${config.vercelTeamSlug}:sub": "owner:${config.vercelTeamSlug}:project:${config.vercelProjectName}:environment:*"
            }
          }
        },
        ${serviceStatement}
      ]
    }`;
    } else {
      // Single OIDC statement
      assumeRolePolicy = pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {
          "Federated": "${config.oidcProvider.arn}"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "oidc.vercel.com/${config.vercelTeamSlug}:aud": "https://vercel.com/${config.vercelTeamSlug}"
          },
          "StringLike": {
            "oidc.vercel.com/${config.vercelTeamSlug}:sub": "owner:${config.vercelTeamSlug}:project:${config.vercelProjectName}:environment:*"
          }
        }
      }]
    }`;
    }
  } else if (config.provider === "aws") {
    assumeRolePolicy = pulumi.output(`{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {
          "Service": ["lambda.amazonaws.com", "ec2.amazonaws.com", "ecs-tasks.amazonaws.com"]
        },
        "Action": "sts:AssumeRole"
      }]
    }`);
  } else {
    // railway / other: access-key-based providers — allow any IAM identity in the
    // account to assume the role so users can attach it to an IAM user or role.
    const identity = await aws.getCallerIdentity();
    assumeRolePolicy = pulumi.output(`{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::${identity.accountId}:root"
        },
        "Action": "sts:AssumeRole"
      }]
    }`);
  }

  // Check if role already exists
  const roleName = `wraps-${config.serviceName}-role`;
  const exists = await roleExists(roleName);

  const tags: Record<string, string> = {
    ManagedBy: "wraps-cli",
    Provider: config.provider,
    ...config.extraTags,
  };

  const role = exists
    ? new aws.iam.Role(
        roleName,
        { name: roleName, assumeRolePolicy, tags },
        {
          import: roleName,
          ...(config.customTimeouts && {
            customTimeouts: config.customTimeouts,
          }),
        }
      )
    : new aws.iam.Role(
        roleName,
        { name: roleName, assumeRolePolicy, tags },
        config.customTimeouts
          ? { customTimeouts: config.customTimeouts }
          : undefined
      );

  // Attach policy to role
  const policyName = `wraps-${config.serviceName}-policy`;
  const isOutputStatements = pulumi.Output.isInstance(config.policyStatements);

  if (isOutputStatements) {
    new aws.iam.RolePolicy(policyName, {
      role: role.name,
      policy: (config.policyStatements as pulumi.Output<any[]>).apply((stmts) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: stmts,
        })
      ),
    });
  } else {
    new aws.iam.RolePolicy(policyName, {
      role: role.name,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: config.policyStatements,
      }),
    });
  }

  return role;
}
