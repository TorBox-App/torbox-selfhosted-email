import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { deployStorageStack } from "../../infrastructure/storage-stack.js";
import { getTelemetryClient } from "../../telemetry/client.js";
import { trackCommand } from "../../telemetry/events.js";
import type {
  StorageStackConfig,
  WrapsStorageConfig,
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
} from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Storage sync command options
 */
export type StorageSyncOptions = {
  region?: string;
};

/**
 * Storage Sync command - Update infrastructure to match current configuration
 */
export async function storageSync(options: StorageSyncOptions): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps Storage Sync"));

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  let region = options.region || (await getAWSRegion());

  if (
    !(
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION
    )
  ) {
    const storageConnections = await findConnectionsWithService(
      identity.accountId,
      "storage"
    );

    if (storageConnections.length === 1) {
      region = storageConnections[0].region;
    } else if (storageConnections.length > 1) {
      const selectedRegion = await clack.select({
        message: "Multiple storage deployments found. Which region?",
        options: storageConnections.map((conn) => ({
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

  // 3. Load existing metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services.storage) {
    clack.log.error(
      `No storage infrastructure found for account ${pc.cyan(identity.accountId)} in region ${pc.cyan(region)}`
    );
    clack.log.info(
      `Use ${pc.cyan("wraps storage init")} to deploy storage infrastructure.`
    );
    process.exit(1);
  }

  const storageService = metadata.services.storage;
  const storageConfig = storageService.config as WrapsStorageConfig;

  progress.info(`Found storage deployment in ${pc.cyan(region)}`);

  // 3.5. Check if we have a manually validated cert (for custom domain support)
  let certValidated = false;
  let existingCertArn: string | undefined;

  // If config has a custom domain, we need to check if the cert is validated
  if (storageConfig.cdn.customDomain) {
    try {
      // Load Pulumi stack to get cert ARN
      await ensurePulumiWorkDir();

      const checkStack = await pulumi.automation.LocalWorkspace.selectStack({
        stackName: `wraps-storage-${identity.accountId}-${region}`,
        workDir: getPulumiWorkDir(),
      });

      const stackOutputs = await checkStack.outputs();

      if (stackOutputs.acmCertificateArn?.value) {
        // Check cert status
        const { ACMClient, DescribeCertificateCommand } = await import(
          "@aws-sdk/client-acm"
        );
        const acmClient = new ACMClient({ region: "us-east-1" });

        const certResponse = await acmClient.send(
          new DescribeCertificateCommand({
            CertificateArn: stackOutputs.acmCertificateArn.value,
          })
        );

        if (certResponse.Certificate?.Status === "ISSUED") {
          certValidated = true;
          existingCertArn = stackOutputs.acmCertificateArn.value;
          progress.info(
            `Certificate validated for ${pc.cyan(storageConfig.cdn.customDomain)}`
          );
        }
      }
    } catch (_error) {
      // Stack might not exist yet, that's fine
    }
  }

  // 4. Build stack config with cert validation flags
  const stackConfig: StorageStackConfig = {
    provider: metadata.provider,
    region,
    accountId: identity.accountId,
    vercel: metadata.vercel,
    storageConfig,
    // Pass cert validation flags if cert is validated externally
    certValidated,
    existingCertArn,
  };

  // 5. Run Pulumi refresh + up
  try {
    await progress.execute("Syncing storage infrastructure", async () => {
      await ensurePulumiWorkDir();

      const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
        {
          stackName: `wraps-storage-${identity.accountId}-${region}`,
          projectName: "wraps-storage",
          program: async () => {
            const result = await deployStorageStack(stackConfig);
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

      // Refresh to sync state with AWS
      await stack.refresh({ onOutput: () => {} });

      // Apply any changes
      const result = await stack.up({ onOutput: () => {} });

      return result.summary;
    });
  } catch (error: any) {
    trackCommand("storage:sync", {
      success: false,
      error: error.message,
      region,
      duration_ms: Date.now() - startTime,
    });

    clack.log.error(`Sync failed: ${error.message}`);
    process.exit(1);
  }

  // 6. Success
  clack.log.success(pc.green("Storage infrastructure synced!"));

  trackCommand("storage:sync", {
    success: true,
    region,
    duration_ms: Date.now() - startTime,
  });

  getTelemetryClient().showFooterOnce();
  clack.outro("");
}
