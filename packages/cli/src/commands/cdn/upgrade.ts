import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { deployCdnStack } from "../../infrastructure/cdn-stack.js";
import { getTelemetryClient } from "../../telemetry/client.js";
import { trackCommand } from "../../telemetry/events.js";
import type {
  CdnStackConfig,
  CdnUpgradeOptions,
  WrapsCdnConfig,
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
  findConnectionsWithService,
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Storage Upgrade command - Add custom domain to CloudFront after certificate validation
 */
export async function cdnUpgrade(options: CdnUpgradeOptions): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(
    pc.bold(options.preview ? "Wraps CDN Upgrade Preview" : "Wraps CDN Upgrade")
  );

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  progress.info(`Connected to AWS account: ${pc.cyan(identity.accountId)}`);

  // 2. Get region
  let region = options.region || (await getAWSRegion());

  // If using default region, check if we have metadata for other regions
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
      region = cdnConnections[0].region;
    } else if (cdnConnections.length > 1) {
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

  // 3. Load existing connection metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services.cdn) {
    clack.log.error(
      `No CDN infrastructure found for account ${pc.cyan(identity.accountId)} in region ${pc.cyan(region)}`
    );
    clack.log.info(
      `Use ${pc.cyan("wraps cdn init")} to deploy CDN infrastructure.`
    );
    process.exit(1);
  }

  const cdnService = metadata.services.cdn;
  const cdnConfig = cdnService.config as WrapsCdnConfig;

  // 4. Load current Pulumi stack to check state
  let stackOutputs: any = {};
  try {
    await ensurePulumiWorkDir();

    const stack = await pulumi.automation.LocalWorkspace.selectStack({
      stackName: `wraps-cdn-${identity.accountId}-${region}`,
      workDir: getPulumiWorkDir(),
    });

    stackOutputs = await stack.outputs();
  } catch (_error: any) {
    clack.log.error("Failed to load storage stack state");
    process.exit(1);
  }

  // 5. Check what can be upgraded
  // First, check if custom domain is already on CloudFront (may not be in stack outputs)
  let cloudFrontHasCustomDomain = false;
  if (stackOutputs.distributionId?.value && cdnConfig.cdn?.customDomain) {
    try {
      const { CloudFrontClient, GetDistributionCommand } = await import(
        "@aws-sdk/client-cloudfront"
      );
      const cfClient = new CloudFrontClient({ region: "us-east-1" });
      const cfResponse = await cfClient.send(
        new GetDistributionCommand({
          Id: stackOutputs.distributionId.value,
        })
      );
      const aliases =
        cfResponse.Distribution?.DistributionConfig?.Aliases?.Items || [];
      cloudFrontHasCustomDomain = aliases.includes(cdnConfig.cdn.customDomain);
    } catch {
      // Ignore errors checking CloudFront
    }
  }

  const hasPendingCert =
    stackOutputs.acmCertificateArn?.value &&
    !stackOutputs.customDomain?.value &&
    !cloudFrontHasCustomDomain;
  const pendingDomain =
    stackOutputs.customDomainPending?.value ||
    (hasPendingCert &&
    stackOutputs.acmCertificateValidationRecords?.value?.[0]?.name
      ? stackOutputs.acmCertificateValidationRecords.value[0].name
          .replace(/^_[^.]+\./, "")
          .replace(/\.$/, "")
      : undefined);

  // Show custom domain status from actual CloudFront config or stack outputs
  const activeCustomDomain = cloudFrontHasCustomDomain
    ? cdnConfig.cdn?.customDomain
    : stackOutputs.customDomain?.value;

  if (!hasPendingCert) {
    clack.log.info("No pending upgrades found for CDN infrastructure.");
    clack.log.info(
      "\nCurrent configuration:\n" +
        `  S3 Bucket: ${pc.cyan(stackOutputs.bucketName?.value)}\n` +
        `  Region: ${pc.cyan(stackOutputs.region?.value || region)}\n` +
        `  CDN: ${stackOutputs.distributionId?.value ? pc.green("Enabled") : pc.dim("Disabled")}\n` +
        `  Custom Domain: ${activeCustomDomain ? pc.green(activeCustomDomain) : pc.dim("Not configured")}`
    );
    process.exit(0);
  }

  // 6. Check if certificate is validated
  progress.start("Checking certificate validation status");

  const { ACMClient, DescribeCertificateCommand } = await import(
    "@aws-sdk/client-acm"
  );
  const acmClient = new ACMClient({ region: "us-east-1" }); // ACM certs for CloudFront are always in us-east-1

  let certStatus: string;
  try {
    const certResponse = await acmClient.send(
      new DescribeCertificateCommand({
        CertificateArn: stackOutputs.acmCertificateArn.value,
      })
    );
    certStatus = certResponse.Certificate?.Status || "UNKNOWN";
  } catch (error: any) {
    progress.fail("Failed to check certificate status");
    clack.log.error(`Error: ${error.message}`);
    process.exit(1);
  }

  progress.stop();

  if (certStatus !== "ISSUED") {
    clack.log.warn(
      `Certificate status: ${pc.yellow(certStatus)} (must be ISSUED to proceed)`
    );
    clack.log.info(`\nPending domain: ${pc.cyan(pendingDomain)}`);
    clack.log.info(
      "\nTo complete certificate validation, add this DNS record:\n"
    );

    if (stackOutputs.acmCertificateValidationRecords?.value?.length) {
      for (const record of stackOutputs.acmCertificateValidationRecords.value) {
        clack.log.info(`  ${pc.cyan(record.type)} ${record.name}`);
        clack.log.info(`  ${pc.dim(">")} ${record.value}\n`);
      }
    }

    clack.log.info(
      "After adding the DNS record, wait for validation (typically 5-30 minutes)."
    );
    clack.log.info(`Then run ${pc.cyan("wraps cdn upgrade")} again.\n`);
    process.exit(0);
  }

  // Certificate is validated!
  clack.log.success(`Certificate validated ${pc.green("!")}`);
  clack.log.info(`\nReady to add custom domain: ${pc.cyan(pendingDomain)}`);
  clack.log.info(
    `This will update CloudFront to serve content from ${pc.cyan(`https://${pendingDomain}`)}\n`
  );

  // 7. Confirm upgrade
  if (!(options.yes || options.preview)) {
    const confirmed = await clack.confirm({
      message: "Proceed with adding custom domain to CloudFront?",
      initialValue: true,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Upgrade cancelled.");
      process.exit(0);
    }
  }

  // 8. Update the storage config to include the custom domain
  const updatedConfig: WrapsCdnConfig = {
    ...cdnConfig,
    cdn: {
      ...cdnConfig.cdn,
      customDomain: pendingDomain,
    },
  };

  // 9. Build stack configuration with cert validation flags
  const stackConfig: CdnStackConfig = {
    provider: metadata.provider,
    region,
    accountId: identity.accountId,
    vercel: metadata.vercel,
    cdnConfig: updatedConfig,
    // Tell deployCdnStack that the cert is validated externally (manual DNS)
    certValidated: true,
    existingCertArn: stackOutputs.acmCertificateArn.value,
  };

  // 10. Preview or Deploy
  if (options.preview) {
    clack.log.info("Preview mode - showing what would change:\n");
    clack.log.info(`  ${pc.green("+")} Add custom domain to CloudFront`);
    clack.log.info(`    Domain: ${pc.cyan(pendingDomain)}`);
    clack.log.info(
      `    Certificate: ${pc.dim(stackOutputs.acmCertificateArn.value)}\n`
    );
    clack.outro(
      pc.green("Preview complete. Run without --preview to upgrade.")
    );

    trackCommand("storage:upgrade", {
      success: true,
      preview: true,
      region,
      duration_ms: Date.now() - startTime,
    });
    return;
  }

  // DEPLOY MODE
  try {
    await progress.execute(
      "Updating CloudFront distribution (this may take 2-3 minutes)",
      async () => {
        await ensurePulumiWorkDir();

        const stack =
          await pulumi.automation.LocalWorkspace.createOrSelectStack(
            {
              stackName: `wraps-cdn-${identity.accountId}-${region}`,
              projectName: "wraps-cdn",
              program: async () => {
                const result = await deployCdnStack(stackConfig);

                return {
                  roleArn: result.roleArn,
                  bucketName: result.bucketName,
                  bucketArn: result.bucketArn,
                  region: result.region,
                  distributionId: result.distributionId,
                  distributionDomain: result.distributionDomain,
                  customDomain: result.customDomain,
                  customDomainPending: result.customDomainPending,
                  acmCertificateArn: result.acmCertificateArn,
                  acmCertificateValidationRecords:
                    result.acmCertificateValidationRecords,
                  versioning: result.versioning,
                  retention: result.retention,
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

        // Refresh state first
        await stack.refresh({ onOutput: () => {} });

        // Run the update
        await stack.up({ onOutput: () => {} });
      }
    );
  } catch (error: any) {
    trackCommand("storage:upgrade", {
      success: false,
      error: error.message,
      region,
      duration_ms: Date.now() - startTime,
    });

    clack.log.error(`Upgrade failed: ${error.message}`);
    process.exit(1);
  }

  // 11. Update metadata
  if (metadata.services.cdn) {
    metadata.services.cdn.config = updatedConfig;
    await saveConnectionMetadata(metadata);
  }

  // 12. Display success
  clack.log.success(`\n${pc.green("")} ${pc.bold("Upgrade complete!")}\n`);
  clack.log.info(`Custom domain ${pc.cyan(pendingDomain)} is now active.\n`);
  clack.log.info(
    `${pc.bold("Final Step:")} Add this CNAME record to your DNS:\n`
  );
  clack.log.info(`  ${pc.cyan("CNAME")} ${pendingDomain}`);
  clack.log.info(
    `  ${pc.dim(">")} ${stackOutputs.distributionDomain?.value}\n`
  );
  clack.log.info(
    `Your files will be available at: ${pc.cyan(`https://${pendingDomain}/your-file.jpg`)}\n`
  );

  // 13. Track success
  trackCommand("storage:upgrade", {
    success: true,
    region,
    custom_domain_added: true,
    duration_ms: Date.now() - startTime,
  });

  // 14. Show footer
  getTelemetryClient().showFooterOnce();

  clack.outro("");
}
