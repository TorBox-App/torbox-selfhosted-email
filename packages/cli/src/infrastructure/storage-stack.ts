import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type {
  Provider,
  StorageStackConfig,
  StorageStackOutputs,
} from "../types/index.js";
import {
  createStorageACMCertificate,
  createStorageBucket,
  createStorageCDN,
} from "./resources/s3-storage.js";
import { createVercelOIDC } from "./vercel-oidc.js";

/**
 * IAM role configuration for storage
 */
type StorageIAMConfig = {
  provider: Provider;
  oidcProvider?: aws.iam.OpenIdConnectProvider;
  vercelTeamSlug?: string;
  vercelProjectName?: string;
  bucketArn: pulumi.Output<string>;
  distributionArn?: pulumi.Output<string>;
};

/**
 * Check if IAM role exists
 */
async function roleExists(roleName: string): Promise<boolean> {
  try {
    const { IAMClient, GetRoleCommand } = await import("@aws-sdk/client-iam");
    const iam = new IAMClient({
      region: process.env.AWS_REGION || "us-east-1",
    });

    await iam.send(new GetRoleCommand({ RoleName: roleName }));
    return true;
  } catch (error: any) {
    if (
      error.name === "NoSuchEntityException" ||
      error.Code === "NoSuchEntity" ||
      error.Error?.Code === "NoSuchEntity"
    ) {
      return false;
    }
    console.error("Error checking for existing IAM role:", error);
    return false;
  }
}

/**
 * Create IAM role for storage infrastructure
 */
async function createStorageIAMRole(
  config: StorageIAMConfig
): Promise<aws.iam.Role> {
  // Build assume role policy based on provider
  let assumeRolePolicy: pulumi.Output<string>;

  if (config.provider === "vercel" && config.oidcProvider) {
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
  } else if (config.provider === "aws") {
    // Native AWS - EC2, Lambda, ECS can assume
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
    // Other providers - will use access keys
    throw new Error("Other providers not yet implemented");
  }

  // Check if role already exists
  const roleName = "wraps-storage-role";
  const exists = await roleExists(roleName);

  const role = exists
    ? new aws.iam.Role(
        roleName,
        {
          name: roleName,
          assumeRolePolicy,
          tags: {
            ManagedBy: "wraps-cli",
            Service: "storage",
            Provider: config.provider,
          },
        },
        {
          import: roleName,
        }
      )
    : new aws.iam.Role(roleName, {
        name: roleName,
        assumeRolePolicy,
        tags: {
          ManagedBy: "wraps-cli",
          Service: "storage",
          Provider: config.provider,
        },
      });

  // Build policy statements for S3 access
  const statements: any[] = [
    // S3 bucket access
    {
      Sid: "StorageBucketAccess",
      Effect: "Allow",
      Action: [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetObjectTagging",
        "s3:PutObjectTagging",
      ],
      Resource: [config.bucketArn, pulumi.interpolate`${config.bucketArn}/*`],
    },
  ];

  // CloudFront invalidation access (if CDN enabled)
  if (config.distributionArn) {
    statements.push({
      Sid: "CloudFrontInvalidation",
      Effect: "Allow",
      Action: [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations",
      ],
      Resource: config.distributionArn,
    });
  }

  // Attach policy to role
  new aws.iam.RolePolicy("wraps-storage-policy", {
    role: role.name,
    policy: pulumi.all([statements]).apply(([stmts]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: stmts,
      })
    ),
  });

  return role;
}

/**
 * Deploy storage infrastructure stack using Pulumi
 */
export async function deployStorageStack(
  config: StorageStackConfig
): Promise<StorageStackOutputs> {
  // Use account ID from config (already validated by CLI)
  const accountId = config.accountId;

  let oidcProvider: aws.iam.OpenIdConnectProvider | undefined;

  // 1. Create OIDC provider if Vercel
  if (config.provider === "vercel" && config.vercel) {
    oidcProvider = await createVercelOIDC({
      teamSlug: config.vercel.teamSlug,
      accountId,
    });
  }

  // 2. Create S3 bucket
  const bucketResources = await createStorageBucket({
    accountId,
    region: config.region,
    storageConfig: config.storageConfig,
  });

  // 3. Create ACM certificate if custom domain is configured
  let acmResources;
  let hostedZone: { id: string } | null = null;

  if (config.storageConfig.cdn.customDomain) {
    // Extract root domain from custom domain (e.g., cdn.example.com -> example.com)
    const domainParts = config.storageConfig.cdn.customDomain.split(".");
    const rootDomain =
      domainParts.length > 2
        ? domainParts.slice(-2).join(".")
        : config.storageConfig.cdn.customDomain;

    // Check for Route53 hosted zone (for automatic DNS validation)
    const { findHostedZone } = await import("../utils/route53.js");
    hostedZone = await findHostedZone(rootDomain, config.region);

    // Create ACM certificate (in us-east-1 for CloudFront)
    acmResources = await createStorageACMCertificate({
      domain: config.storageConfig.cdn.customDomain,
      hostedZoneId: hostedZone?.id,
    });
  }

  // 4. Create CloudFront distribution (if CDN enabled)
  let cdnResources;
  if (config.storageConfig.cdn.enabled) {
    // Determine which certificate ARN to use:
    // - certValidated: Use existing cert (manual validation completed via upgrade)
    // - Route53: Use certificateValidation.certificateArn (waits for validation)
    // - Manual DNS: Don't use cert yet - it's not validated
    // When there's no Route53 hosted zone, we create CloudFront WITHOUT custom domain
    // User must manually validate cert, then run `storage upgrade` to add custom domain
    const hasAutoValidation = acmResources?.certificateValidation;
    const useCertFromUpgrade = config.certValidated && config.existingCertArn;

    // Certificate ARN: prefer existing validated cert, then auto-validated cert
    const certificateArn = useCertFromUpgrade
      ? pulumi.output(config.existingCertArn!)
      : hasAutoValidation
        ? acmResources?.certificateValidation?.certificateArn
        : undefined;

    // Custom domain: use if cert is available (either from upgrade or auto-validation)
    const customDomainForCdn =
      useCertFromUpgrade || hasAutoValidation
        ? config.storageConfig.cdn.customDomain
        : undefined;

    cdnResources = await createStorageCDN({
      bucket: bucketResources.bucket,
      bucketRegion: config.region, // For Origin Shield
      customDomain: customDomainForCdn,
      certificateArn,
      priceClass: config.storageConfig.cdn.priceClass,
      originShield: config.storageConfig.cdn.originShield,
      geoRestriction: config.storageConfig.cdn.geoRestriction,
      wafEnabled: config.storageConfig.cdn.wafEnabled,
    });
  }

  // 5. Create IAM role with S3 and CloudFront permissions
  const role = await createStorageIAMRole({
    provider: config.provider,
    oidcProvider,
    vercelTeamSlug: config.vercel?.teamSlug,
    vercelProjectName: config.vercel?.projectName,
    bucketArn: bucketResources.bucketArn,
    distributionArn: cdnResources?.distribution.arn,
  });

  // Determine if custom domain is active or pending manual validation
  // Custom domain is active if: Route53 auto-validated OR manually validated via upgrade
  const hasAutoValidation = acmResources?.certificateValidation;
  const hasCertFromUpgrade = config.certValidated && config.existingCertArn;
  const customDomainActive =
    config.storageConfig.cdn.customDomain &&
    (hasAutoValidation || hasCertFromUpgrade);
  const customDomainPending =
    config.storageConfig.cdn.customDomain &&
    !hasAutoValidation &&
    !hasCertFromUpgrade;

  // Return outputs
  return {
    roleArn: role.arn as any as string,
    bucketName: bucketResources.bucketName as any as string,
    bucketArn: bucketResources.bucketArn as any as string,
    region: config.region,
    distributionId: cdnResources?.distributionId as any as string | undefined,
    distributionDomain: cdnResources?.domainName as any as string | undefined,
    // Report custom domain if it's actually configured on CloudFront (auto or manual validation)
    customDomain: customDomainActive
      ? config.storageConfig.cdn.customDomain
      : undefined,
    // Report pending custom domain that needs manual cert validation
    customDomainPending: customDomainPending
      ? config.storageConfig.cdn.customDomain
      : undefined,
    acmCertificateArn: acmResources?.certificate.arn as any as
      | string
      | undefined,
    acmCertificateValidationRecords: acmResources?.validationRecords as any as
      | Array<{ name: string; type: string; value: string }>
      | undefined,
    versioning: config.storageConfig.versioning ?? false,
    retention: config.storageConfig.retention,
  };
}

/**
 * Run Pulumi program inline for storage
 */
export async function runStoragePulumiProgram(
  stackName: string,
  region: string,
  program: () => Promise<StorageStackOutputs>
): Promise<StorageStackOutputs> {
  const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
    {
      stackName,
      projectName: "wraps-storage",
      program,
    },
    {
      workDir: `${process.env.HOME}/.wraps/pulumi`,
    }
  );

  // Set AWS region
  await stack.setConfig("aws:region", { value: region });

  // Run the deployment
  const upResult = await stack.up({
    onOutput: (msg) => process.stdout.write(msg),
  });

  // Get outputs
  const outputs = upResult.outputs;

  return {
    roleArn: outputs.roleArn?.value as string,
    bucketName: outputs.bucketName?.value as string,
    bucketArn: outputs.bucketArn?.value as string,
    region: outputs.region?.value as string,
    distributionId: outputs.distributionId?.value as string | undefined,
    distributionDomain: outputs.distributionDomain?.value as string | undefined,
    customDomain: outputs.customDomain?.value as string | undefined,
    customDomainPending: outputs.customDomainPending?.value as
      | string
      | undefined,
    acmCertificateArn: outputs.acmCertificateArn?.value as string | undefined,
    acmCertificateValidationRecords: outputs.acmCertificateValidationRecords
      ?.value as
      | Array<{ name: string; type: string; value: string }>
      | undefined,
    versioning: outputs.versioning?.value as boolean,
    retention: outputs.retention?.value as any,
  };
}

/**
 * Preview storage stack changes
 */
export async function previewStorageStack(
  stackName: string,
  region: string,
  program: () => Promise<StorageStackOutputs>
): Promise<pulumi.automation.PreviewResult> {
  const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
    {
      stackName,
      projectName: "wraps-storage",
      program,
    },
    {
      workDir: `${process.env.HOME}/.wraps/pulumi`,
    }
  );

  // Set AWS region
  await stack.setConfig("aws:region", { value: region });

  // Run preview
  return stack.preview({
    onOutput: (msg) => process.stdout.write(msg),
  });
}

/**
 * Destroy storage stack
 */
export async function destroyStorageStack(
  stackName: string,
  region: string
): Promise<void> {
  const stack = await pulumi.automation.LocalWorkspace.selectStack(
    {
      stackName,
      projectName: "wraps-storage",
      program: async () => ({}),
    },
    {
      workDir: `${process.env.HOME}/.wraps/pulumi`,
    }
  );

  // Set AWS region
  await stack.setConfig("aws:region", { value: region });

  // Destroy resources
  await stack.destroy({
    onOutput: (msg) => process.stdout.write(msg),
  });

  // Remove the stack
  await stack.workspace.removeStack(stackName);
}
