import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { getTelemetryClient } from "../../telemetry/client.js";
import { trackCommand } from "../../telemetry/events.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { findConnectionsWithService } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Storage status command options
 */
export type CdnStatusOptions = {
  region?: string;
};

/**
 * Storage Status command - Show current CDN infrastructure setup
 */
export async function cdnStatus(options: CdnStatusOptions): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps CDN Status"));

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Loading CDN infrastructure status",
    async () => validateAWSCredentials()
  );

  // 2. Get region - check flag, then env, then metadata, then default
  let region = options.region || (await getAWSRegion());

  // If using default region (us-east-1), check if we have metadata for other regions
  if (
    !(
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION
    )
  ) {
    const cdnConnections = await findConnectionsWithService(
      identity.accountId,
      "cdn"
    );

    if (cdnConnections.length === 1) {
      // Auto-select the only available region
      region = cdnConnections[0].region;
    } else if (cdnConnections.length > 1) {
      // Multiple regions found - prompt user to select
      const selectedRegion = await clack.select({
        message: "Multiple CDN deployments found. Which region?",
        options: cdnConnections.map((conn) => ({
          value: conn.region,
          label: conn.region,
        })),
      });

      if (clack.isCancel(selectedRegion)) {
        clack.cancel("Operation cancelled");
        process.exit(0);
      }

      region = selectedRegion as string;
    }
  }

  // 3. Try to load Pulumi stack
  let stackOutputs: any = {};
  try {
    // Ensure Pulumi workspace is configured (sets backend URL)
    await ensurePulumiWorkDir({ accountId: identity.accountId, region });

    const stack = await pulumi.automation.LocalWorkspace.selectStack({
      stackName: `wraps-cdn-${identity.accountId}-${region}`,
      workDir: getPulumiWorkDir(),
    });

    stackOutputs = await stack.outputs();
  } catch (_error) {
    // guardrail:allow-swallowed-error — stack may not exist
    progress.stop();
    clack.log.error("No CDN infrastructure found");
    console.log(
      `\nRun ${pc.cyan("wraps cdn init")} to deploy CDN infrastructure.\n`
    );
    process.exit(1);
  }

  progress.stop();

  // 4. Display status
  displayCdnStatus({
    bucketName: stackOutputs.bucketName?.value,
    region: stackOutputs.region?.value || region,
    distributionId: stackOutputs.distributionId?.value,
    distributionDomain: stackOutputs.distributionDomain?.value,
    customDomain: stackOutputs.customDomain?.value,
    customDomainPending: stackOutputs.customDomainPending?.value,
    acmCertificateArn: stackOutputs.acmCertificateArn?.value,
    acmCertificateValidationRecords:
      stackOutputs.acmCertificateValidationRecords?.value,
    roleArn: stackOutputs.roleArn?.value,
    versioning: stackOutputs.versioning?.value,
    retention: stackOutputs.retention?.value,
  });

  // 5. Track status command
  trackCommand("storage:status", {
    success: true,
    region,
    has_custom_domain: !!stackOutputs.customDomain?.value,
    has_cdn: !!stackOutputs.distributionId?.value,
    duration_ms: Date.now() - startTime,
  });

  // 6. Show promotional footer (once per session)
  getTelemetryClient().showFooterOnce();
}

/**
 * Display storage status information
 */
function displayCdnStatus(options: {
  bucketName: string;
  region: string;
  distributionId?: string;
  distributionDomain?: string;
  customDomain?: string;
  customDomainPending?: string;
  acmCertificateArn?: string;
  acmCertificateValidationRecords?: Array<{
    name: string;
    type: string;
    value: string;
  }>;
  roleArn: string;
  versioning?: boolean;
  retention?: string;
}): void {
  clack.log.info(`\n${pc.bold("CDN Infrastructure:")}`);

  // S3 Bucket
  clack.log.info(`  S3 Bucket: ${pc.cyan(options.bucketName)}`);
  clack.log.info(`  Region: ${pc.cyan(options.region)}`);

  // Versioning
  clack.log.info(
    `  Versioning: ${options.versioning ? pc.green("Enabled") : pc.dim("Disabled")}`
  );

  // Retention
  const retentionDisplay =
    options.retention === "none" || !options.retention
      ? "Keep forever"
      : options.retention;
  clack.log.info(`  Retention: ${pc.cyan(retentionDisplay)}`);

  // Determine if there's a pending certificate (cert exists but not active on CloudFront)
  const hasPendingCert = options.acmCertificateArn && !options.customDomain;
  // Extract domain from validation record name: _hash.cdn.wraps.dev. -> cdn.wraps.dev
  const pendingDomain =
    options.customDomainPending ||
    (hasPendingCert && options.acmCertificateValidationRecords?.[0]?.name
      ? options.acmCertificateValidationRecords[0].name
          .replace(/^_[^.]+\./, "")
          .replace(/\.$/, "")
      : undefined);

  // CloudFront CDN
  if (options.distributionId) {
    clack.log.info(`\n${pc.bold("CDN (CloudFront):")}`);
    clack.log.info(`  Distribution ID: ${pc.cyan(options.distributionId)}`);

    if (options.distributionDomain) {
      clack.log.info(
        `  Default URL: ${pc.cyan(`https://${options.distributionDomain}`)}`
      );
    }

    if (options.customDomain) {
      clack.log.info(
        `  Custom Domain: ${pc.green(`https://${options.customDomain}`)}`
      );
    } else if (pendingDomain) {
      clack.log.info(
        `  Custom Domain: ${pc.yellow(`${pendingDomain} (pending)`)}`
      );
    }
  } else {
    clack.log.info(
      `\n${pc.dim("CDN: Disabled (files served directly from S3)")}`
    );
  }

  // SSL Certificate (if pending custom domain or unvalidated cert)

  if (hasPendingCert) {
    clack.log.info(`\n${pc.bold("SSL Certificate:")}`);
    clack.log.info(`  Status: ${pc.yellow("Pending Validation")}`);
    clack.log.info(`  ARN: ${pc.dim(options.acmCertificateArn)}`);

    if (options.acmCertificateValidationRecords?.length) {
      clack.log.info(`\n${pc.yellow(pc.bold("DNS Records Required:"))}`);
      clack.log.info("Add these records to validate your certificate:\n");

      for (const record of options.acmCertificateValidationRecords) {
        clack.log.info(`  ${pc.cyan(record.type)} ${record.name}`);
        clack.log.info(`  ${pc.dim("→")} ${record.value}\n`);
      }

      if (options.distributionDomain && pendingDomain) {
        clack.log.info(pc.blue("After certificate validation, add CDN CNAME:"));
        clack.log.info(`  ${pc.cyan("CNAME")} ${pendingDomain}`);
        clack.log.info(`  ${pc.dim("→")} ${options.distributionDomain}\n`);
      }
    }
  }

  // IAM Role
  clack.log.info(`\n${pc.bold("Access:")}`);
  clack.log.info(`  IAM Role: ${pc.dim(options.roleArn)}`);

  // Usage URL
  const cdnUrl = options.customDomain
    ? `https://${options.customDomain}`
    : options.distributionDomain
      ? `https://${options.distributionDomain}`
      : `https://${options.bucketName}.s3.${options.region}.amazonaws.com`;

  clack.log.info(`\n${pc.bold("File URLs:")}`);
  clack.log.info(`  ${pc.cyan(cdnUrl)}/your-file.jpg`);

  // Next steps
  clack.log.info(`\n${pc.bold("Commands:")}`);
  if (hasPendingCert) {
    clack.log.info(
      `  ${pc.cyan("wraps cdn upgrade")} - Add custom domain after cert validation`
    );
  }
  clack.log.info(
    `  ${pc.cyan("wraps cdn verify")} - Check DNS and certificate status`
  );
  clack.log.info(
    `  ${pc.cyan("wraps cdn destroy")} - Remove CDN infrastructure`
  );

  clack.outro("");
}
