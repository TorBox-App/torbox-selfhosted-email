import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { deployCdnStack } from "../../infrastructure/cdn-stack.js";
import {
  trackError,
  trackServiceDeployed,
  trackServiceInit,
} from "../../telemetry/events.js";
import type {
  CdnConfigPreset,
  CdnStackConfig,
  CloudFrontPriceClass,
  GeoRestriction,
  WrapsCdnConfig,
} from "../../types/index.js";
import { getCostSummary } from "../../utils/cdn/costs.js";
import {
  getPreset,
  getPresetInfo,
  validateConfig,
} from "../../utils/cdn/presets.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { errors } from "../../utils/shared/errors.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import {
  addServiceToConnection,
  hasService,
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";
import {
  DeploymentProgress,
  displayPreview,
} from "../../utils/shared/output.js";
import {
  confirmDeploy,
  promptProvider,
  promptRegion,
  promptVercelConfig,
} from "../../utils/shared/prompts.js";
import {
  ensurePulumiInstalled,
  previewWithResourceChanges,
} from "../../utils/shared/pulumi.js";

/**
 * Storage init command options
 */
export type CdnInitOptions = {
  provider?: "vercel" | "aws" | "railway" | "other";
  region?: string;
  preset?: CdnConfigPreset;
  domain?: string;
  yes?: boolean;
  preview?: boolean;
  json?: boolean;
};

/**
 * Prompt for CDN configuration preset
 */
async function promptCdnPreset(): Promise<CdnConfigPreset> {
  const starterInfo = getPresetInfo("starter");
  const productionInfo = getPresetInfo("production");
  const customInfo = getPresetInfo("custom");

  const result = await clack.select({
    message: "Select a CDN configuration preset:",
    options: [
      {
        value: "production" as const,
        label: `${pc.green("Production")} ${pc.dim("(Recommended)")}`,
        hint: `${productionInfo.estimatedCost} - ${productionInfo.description}`,
      },
      {
        value: "starter" as const,
        label: pc.blue("Starter"),
        hint: `${starterInfo.estimatedCost} - ${starterInfo.description}`,
      },
      {
        value: "custom" as const,
        label: pc.yellow("Custom"),
        hint: customInfo.description,
      },
    ],
  });

  if (clack.isCancel(result)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  return result;
}

/**
 * Prompt for custom CDN configuration
 */
async function promptCustomCdnConfig(): Promise<WrapsCdnConfig> {
  // CDN enabled?
  const cdnEnabled = await clack.confirm({
    message: "Enable CloudFront CDN for fast global delivery?",
    initialValue: true,
  });

  if (clack.isCancel(cdnEnabled)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  // CDN-specific options
  let priceClass: CloudFrontPriceClass = "PriceClass_All";
  let originShield = false;
  let geoRestriction: GeoRestriction = { type: "none" };

  if (cdnEnabled) {
    // Edge locations (price class)
    const priceClassResult = await clack.select({
      message: "Where should content be cached? (edge locations)",
      options: [
        {
          value: "PriceClass_All" as const,
          label: "Global (400+ edges)",
          hint: "Best performance, highest cost",
        },
        {
          value: "PriceClass_200" as const,
          label: "Most regions (no SA/AU)",
          hint: "Good coverage, moderate cost",
        },
        {
          value: "PriceClass_100" as const,
          label: "US, Canada, Europe only",
          hint: "Limited coverage, lowest cost",
        },
      ],
    });

    if (clack.isCancel(priceClassResult)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }
    priceClass = priceClassResult;

    // Origin Shield
    const originShieldResult = await clack.confirm({
      message: "Enable Origin Shield? (reduces S3 requests by ~80%)",
      initialValue: priceClass === "PriceClass_All", // Recommend for global
    });

    if (clack.isCancel(originShieldResult)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }
    originShield = originShieldResult;

    // Geo restriction
    const geoRestrictionType = await clack.select({
      message: "Restrict access by country?",
      options: [
        {
          value: "none" as const,
          label: "No restrictions (accessible globally)",
        },
        { value: "whitelist" as const, label: "Allow only specific countries" },
        { value: "blacklist" as const, label: "Block specific countries" },
      ],
    });

    if (clack.isCancel(geoRestrictionType)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }

    if (geoRestrictionType !== "none") {
      const countriesInput = await clack.text({
        message:
          geoRestrictionType === "whitelist"
            ? "Enter country codes to ALLOW (comma-separated, e.g., US,CA,GB):"
            : "Enter country codes to BLOCK (comma-separated, e.g., RU,CN):",
        placeholder: "US,CA,GB",
        validate: (value) => {
          if (!value.trim()) {
            return "At least one country code is required";
          }
          const codes = value.split(",").map((c) => c.trim().toUpperCase());
          const invalidCodes = codes.filter((c) => !/^[A-Z]{2}$/.test(c));
          if (invalidCodes.length > 0) {
            return `Invalid country codes: ${invalidCodes.join(", ")} (use ISO 3166-1 alpha-2)`;
          }
          return;
        },
      });

      if (clack.isCancel(countriesInput)) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }

      const countries = countriesInput
        .split(",")
        .map((c) => c.trim().toUpperCase());
      geoRestriction = { type: geoRestrictionType, countries };
    }
  }

  // Versioning?
  const versioning = await clack.confirm({
    message: "Enable S3 versioning? (keeps old versions of replaced files)",
    initialValue: false,
  });

  if (clack.isCancel(versioning)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Retention
  const retention = await clack.select({
    message: "Auto-delete files after a period?",
    options: [
      { value: "none" as const, label: "Never (keep forever)" },
      { value: "30days" as const, label: "30 days" },
      { value: "60days" as const, label: "60 days" },
      { value: "90days" as const, label: "90 days" },
      { value: "180days" as const, label: "180 days" },
      { value: "1year" as const, label: "1 year" },
    ],
  });

  if (clack.isCancel(retention)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  return {
    cdn: {
      enabled: cdnEnabled,
      priceClass,
      originShield,
      geoRestriction,
    },
    versioning,
    encryption: "aes256",
    retention,
  };
}

/**
 * Prompt for custom CDN domain
 */
async function promptCustomDomain(): Promise<string | undefined> {
  const wantCustomDomain = await clack.confirm({
    message: "Configure a custom CDN domain? (e.g., cdn.yourapp.com)",
    initialValue: false,
  });

  if (clack.isCancel(wantCustomDomain)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  if (!wantCustomDomain) {
    return;
  }

  const domain = await clack.text({
    message: "Enter your custom CDN domain:",
    placeholder: "cdn.yourapp.com",
    validate: (value) => {
      if (!value.trim()) {
        return "Domain is required";
      }
      if (
        !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(
          value
        )
      ) {
        return "Invalid domain format";
      }
      return;
    },
  });

  if (clack.isCancel(domain)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  return domain;
}

/**
 * Prompt for estimated storage usage
 */
async function promptEstimatedUsage(): Promise<{
  storageGB: number;
  bandwidthGB: number;
}> {
  const usage = await clack.select({
    message: "Estimated monthly usage (for cost estimate):",
    options: [
      {
        value: "small",
        label: "Small (5GB storage, 20GB bandwidth)",
        hint: "Side projects",
      },
      {
        value: "medium",
        label: "Medium (25GB storage, 100GB bandwidth)",
        hint: "Production apps",
      },
      {
        value: "large",
        label: "Large (100GB storage, 500GB bandwidth)",
        hint: "High-traffic apps",
      },
    ],
  });

  if (clack.isCancel(usage)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  switch (usage) {
    case "small":
      return { storageGB: 5, bandwidthGB: 20 };
    case "medium":
      return { storageGB: 25, bandwidthGB: 100 };
    case "large":
      return { storageGB: 100, bandwidthGB: 500 };
    default:
      return { storageGB: 25, bandwidthGB: 100 };
  }
}

/**
 * Init command - Deploy new CDN infrastructure
 */
export async function init(options: CdnInitOptions): Promise<void> {
  const startTime = Date.now();

  if (!isJsonMode()) {
    clack.intro(
      pc.bold(
        options.preview
          ? "Wraps CDN Infrastructure Preview"
          : "Wraps CDN Infrastructure Setup"
      )
    );
  }

  const progress = new DeploymentProgress();

  // 1. Check Pulumi CLI is installed (auto-install if missing)
  const wasAutoInstalled = await progress.execute(
    "Checking Pulumi CLI installation",
    async () => await ensurePulumiInstalled()
  );

  if (wasAutoInstalled) {
    progress.info("Pulumi CLI was automatically installed");
  }

  // 2. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  progress.info(`Connected to AWS account: ${pc.cyan(identity.accountId)}`);

  // 3. Get configuration (from options or prompts)
  let provider = options.provider;
  if (!provider) {
    provider = await promptProvider();
  }

  let region = options.region;
  if (!region) {
    const defaultRegion = await getAWSRegion();
    region = await promptRegion(defaultRegion);
  }

  // Get Vercel config if needed
  let vercelConfig;
  if (provider === "vercel") {
    vercelConfig = await promptVercelConfig();
  }

  // 4. Check if CDN service already exists for this account/region
  const existingConnection = await loadConnectionMetadata(
    identity.accountId,
    region
  );

  if (existingConnection && hasService(existingConnection, "cdn")) {
    clack.log.warn(
      `CDN service already exists for account ${pc.cyan(identity.accountId)} in region ${pc.cyan(region)}`
    );
    clack.log.info(`Created: ${existingConnection.services.cdn?.deployedAt}`);
    clack.log.info(`Use ${pc.cyan("wraps cdn status")} to view current setup`);
    process.exit(0);
  }

  // 5. Configuration selection
  let preset = options.preset;
  if (!preset) {
    preset = await promptCdnPreset();
  }

  let cdnConfig: WrapsCdnConfig;
  if (preset === "custom") {
    cdnConfig = await promptCustomCdnConfig();
  } else {
    cdnConfig = getPreset(preset)!;
  }

  // 6. Custom domain configuration (whenever CDN is enabled)
  let customDomain = options.domain;
  if (!customDomain && cdnConfig.cdn.enabled) {
    customDomain = await promptCustomDomain();
  }

  if (customDomain) {
    cdnConfig.cdn.customDomain = customDomain;
  }

  // 7. Get estimated usage for cost calculation
  const estimatedUsage = await promptEstimatedUsage();

  // Display cost summary
  progress.info(`\n${pc.bold("Cost Estimate:")}`);
  const costSummary = getCostSummary(
    cdnConfig,
    estimatedUsage.storageGB,
    estimatedUsage.bandwidthGB
  );
  clack.log.info(costSummary);

  // Validate configuration and show warnings
  const warnings = validateConfig(cdnConfig);
  if (warnings.length > 0) {
    progress.info(`\n${pc.yellow(pc.bold("Configuration Notes:"))}`);
    for (const warning of warnings) {
      clack.log.info(warning);
    }
  }

  // 8. Create or update metadata
  const metadata = addServiceToConnection(
    identity.accountId,
    region,
    provider,
    "cdn",
    cdnConfig,
    preset === "custom" ? undefined : preset,
    existingConnection || undefined
  );

  if (vercelConfig) {
    metadata.vercel = vercelConfig;
  }

  // Confirm deployment (skip if --yes flag or --preview flag)
  if (!(options.yes || options.preview)) {
    const confirmed = await confirmDeploy();
    if (!confirmed) {
      clack.cancel("Deployment cancelled.");
      process.exit(0);
    }
  }

  // 9. Build stack configuration
  const stackConfig: CdnStackConfig = {
    provider,
    region,
    accountId: identity.accountId,
    vercel: vercelConfig,
    cdnConfig,
  };

  // 10. Preview or Deploy infrastructure using Pulumi
  if (options.preview) {
    // PREVIEW MODE - show what would be created without deploying
    try {
      const previewResult = await progress.execute(
        "Generating infrastructure preview",
        async () => {
          await ensurePulumiWorkDir({ accountId: identity.accountId, region });

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

          // Run preview with resource change capture
          const result = await previewWithResourceChanges(stack, {
            diff: true,
          });
          return result;
        }
      );

      // Display preview results with detailed resource changes
      displayPreview({
        changeSummary: previewResult.changeSummary,
        resourceChanges: previewResult.resourceChanges,
        costEstimate: costSummary,
        commandName: "wraps cdn init",
      });

      clack.outro(
        pc.green("Preview complete. Run without --preview to deploy.")
      );

      // Track preview completion
      trackServiceInit("cdn", true, {
        preset,
        provider,
        region,
        preview: true,
        duration_ms: Date.now() - startTime,
      });
      return;
    } catch (error) {
      trackError("PREVIEW_FAILED", "storage:init", { step: "preview" });
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("stack is currently locked")) {
        throw errors.stackLocked();
      }
      throw new Error(`Preview failed: ${msg}`);
    }
  }

  // DEPLOY MODE - actually create infrastructure
  let outputs;
  try {
    outputs = await progress.execute(
      "Deploying CDN infrastructure (this may take 2-3 minutes)",
      async () => {
        // Ensure Pulumi workspace directory exists
        await ensurePulumiWorkDir({ accountId: identity.accountId, region });

        // Run Pulumi inline program with local backend (no cloud required)
        const stack =
          await pulumi.automation.LocalWorkspace.createOrSelectStack(
            {
              stackName: `wraps-cdn-${identity.accountId}-${region}`,
              projectName: "wraps-cdn",
              program: async () => {
                const result = await deployCdnStack(stackConfig);

                // Export outputs
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

        // Set backend to local file system
        await stack.workspace.selectStack(
          `wraps-cdn-${identity.accountId}-${region}`
        );

        // Set AWS region
        await stack.setConfig("aws:region", { value: region });

        // Run the deployment
        const upResult = await stack.up({ onOutput: () => {} });

        // Get outputs
        const pulumiOutputs = upResult.outputs;

        return {
          roleArn: pulumiOutputs.roleArn?.value as string,
          bucketName: pulumiOutputs.bucketName?.value as string,
          bucketArn: pulumiOutputs.bucketArn?.value as string,
          region: pulumiOutputs.region?.value as string,
          distributionId: pulumiOutputs.distributionId?.value as
            | string
            | undefined,
          distributionDomain: pulumiOutputs.distributionDomain?.value as
            | string
            | undefined,
          customDomain: pulumiOutputs.customDomain?.value as string | undefined,
          customDomainPending: pulumiOutputs.customDomainPending?.value as
            | string
            | undefined,
          acmCertificateArn: pulumiOutputs.acmCertificateArn?.value as
            | string
            | undefined,
          acmCertificateValidationRecords: pulumiOutputs
            .acmCertificateValidationRecords?.value as
            | Array<{ name: string; type: string; value: string }>
            | undefined,
          versioning: pulumiOutputs.versioning?.value as boolean,
          retention: pulumiOutputs.retention?.value as string | undefined,
        };
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Track deployment failure
    trackServiceInit("cdn", false, {
      preset,
      provider,
      region,
      duration_ms: Date.now() - startTime,
    });

    // Check if it's a lock file error
    if (msg.includes("stack is currently locked")) {
      trackError("STACK_LOCKED", "storage:init", { step: "deploy" });
      throw errors.stackLocked();
    }

    trackError("DEPLOYMENT_FAILED", "storage:init", { step: "deploy" });
    throw new Error(`Pulumi deployment failed: ${msg}`);
  }

  // 11. Save metadata for future upgrades and restore
  if (metadata.services.cdn) {
    metadata.services.cdn.pulumiStackName = `wraps-cdn-${identity.accountId}-${region}`;
  }
  await saveConnectionMetadata(metadata);

  progress.info("Connection metadata saved");

  // JSON mode: output results and skip interactive DNS steps
  if (isJsonMode()) {
    jsonSuccess("cdn.init", {
      roleArn: outputs.roleArn,
      bucketName: outputs.bucketName,
      region: outputs.region,
      distributionId: outputs.distributionId,
    });
    trackServiceDeployed("cdn", {
      duration_ms: Date.now() - startTime,
      region,
      features: [],
      preset,
    });
    return;
  }

  // 12. Handle DNS for custom domain (follow email/SMS pattern)
  let dnsAutoCreated = false;
  let hostedZoneFound = false; // Track if Route53 hosted zone exists (cert validation auto-created by Pulumi)

  if (outputs.customDomain && outputs.distributionDomain) {
    const { findHostedZone } = await import("../../utils/route53.js");
    const { promptDNSManagement } = await import(
      "../../utils/shared/prompts.js"
    );

    // Extract root domain from custom domain (e.g., cdn.example.com -> example.com)
    const domainParts = outputs.customDomain.split(".");
    const rootDomain =
      domainParts.length > 2
        ? domainParts.slice(-2).join(".")
        : outputs.customDomain;

    const hostedZone = await findHostedZone(rootDomain, region);
    hostedZoneFound = !!hostedZone;

    if (hostedZone) {
      // Ask if user wants to manage DNS via Route53
      const manageDNS = await promptDNSManagement(outputs.customDomain);

      if (manageDNS) {
        try {
          // Preview DNS changes and show conflicts
          progress.start("Checking existing DNS records");

          const {
            Route53Client,
            ListResourceRecordSetsCommand,
            ChangeResourceRecordSetsCommand,
          } = await import("@aws-sdk/client-route-53");
          const route53 = new Route53Client({ region: "us-east-1" });

          // Check for existing CNAME record on custom domain
          const existingRecords = await route53.send(
            new ListResourceRecordSetsCommand({
              HostedZoneId: hostedZone.id,
              StartRecordName: outputs.customDomain,
              StartRecordType: "CNAME",
              MaxItems: 1,
            })
          );

          progress.stop();

          const existingCname = existingRecords.ResourceRecordSets?.find(
            (r) =>
              r.Type === "CNAME" &&
              (r.Name === outputs.customDomain ||
                r.Name === `${outputs.customDomain}.`)
          );

          // Build DNS preview
          type CdnDNSRecord = {
            name: string;
            type: "CNAME";
            proposedValue: string;
            existingValue: string | null;
            status: "new" | "update" | "no_change" | "conflict";
            conflictReason?: string;
          };

          const dnsRecords: CdnDNSRecord[] = [];

          // Custom domain CNAME
          const existingValue =
            existingCname?.ResourceRecords?.[0]?.Value || null;
          let cdnStatus: CdnDNSRecord["status"] = "new";
          let cdnConflictReason: string | undefined;

          if (existingValue === outputs.distributionDomain) {
            cdnStatus = "no_change";
          } else if (existingValue) {
            cdnStatus = "conflict";
            cdnConflictReason = `Currently points to ${existingValue}`;
          }

          dnsRecords.push({
            name: outputs.customDomain,
            type: "CNAME",
            proposedValue: outputs.distributionDomain,
            existingValue,
            status: cdnStatus,
            conflictReason: cdnConflictReason,
          });

          // Note: Certificate validation records are automatically created by Pulumi
          // when a Route53 hosted zone is found during deployment. We only need to
          // create the CDN domain CNAME here. If no hosted zone was found during
          // Pulumi deployment, the user will need to manually add cert validation
          // records (shown in the success message).

          // Display DNS preview
          console.log();
          clack.log.info(pc.bold("DNS Records to Create"));
          console.log();

          const newCount = dnsRecords.filter((r) => r.status === "new").length;
          const conflictCount = dnsRecords.filter(
            (r) => r.status === "conflict"
          ).length;
          const noChangeCount = dnsRecords.filter(
            (r) => r.status === "no_change"
          ).length;

          const summaryParts: string[] = [];
          if (newCount > 0) {
            summaryParts.push(pc.green(`${newCount} new`));
          }
          if (conflictCount > 0) {
            summaryParts.push(pc.red(`${conflictCount} conflicts`));
          }
          if (noChangeCount > 0) {
            summaryParts.push(pc.dim(`${noChangeCount} unchanged`));
          }
          console.log(`  ${summaryParts.join(" | ")}\n`);

          for (const record of dnsRecords) {
            const statusIcon =
              record.status === "new"
                ? pc.green("●")
                : record.status === "conflict"
                  ? pc.red("●")
                  : pc.dim("○");

            console.log(
              `  ${statusIcon} ${pc.cyan("[CDN]")} ${pc.bold(record.type)} ${record.name}`
            );
            console.log(`    ${pc.dim("→")} ${record.proposedValue}`);

            if (record.existingValue && record.status !== "no_change") {
              console.log(
                `    ${pc.yellow("⚠")} ${pc.yellow(record.conflictReason || `Existing: ${record.existingValue}`)}`
              );
            }
            console.log();
          }

          // Warn about conflicts
          if (conflictCount > 0) {
            clack.log.warn(
              pc.yellow(
                "Some records have conflicts. Creating them will overwrite existing values."
              )
            );
          }

          // Ask for confirmation
          const shouldCreate = await clack.confirm({
            message:
              conflictCount > 0
                ? `Create ${newCount + conflictCount} DNS record(s)? (${conflictCount} will overwrite existing)`
                : `Create ${newCount} DNS record(s) in Route53?`,
            initialValue: true,
          });

          if (!clack.isCancel(shouldCreate) && shouldCreate) {
            progress.start("Creating DNS records in Route53");

            const changes = dnsRecords
              .filter((r) => r.status !== "no_change")
              .map((record) => ({
                Action: "UPSERT" as const,
                ResourceRecordSet: {
                  Name: record.name,
                  Type: record.type as "CNAME",
                  TTL: 300,
                  ResourceRecords: [{ Value: record.proposedValue }],
                },
              }));

            if (changes.length > 0) {
              await route53.send(
                new ChangeResourceRecordSetsCommand({
                  HostedZoneId: hostedZone.id,
                  ChangeBatch: { Changes: changes },
                })
              );
            }

            progress.succeed(
              `Created ${changes.length} DNS record(s) in Route53`
            );
            dnsAutoCreated = true;
          } else {
            clack.log.info(
              "Skipping DNS record creation. You can add them manually."
            );
          }
        } catch (error) {
          progress.stop();
          const msg = error instanceof Error ? error.message : String(error);
          clack.log.warn(`Could not manage DNS records: ${msg}`);
        }
      }
    }
  }

  // 13. Display success message
  displayCdnSuccess({
    bucketName: outputs.bucketName,
    region: outputs.region,
    distributionDomain: outputs.distributionDomain,
    customDomain: outputs.customDomain,
    customDomainPending: outputs.customDomainPending,
    roleArn: outputs.roleArn,
    versioning: outputs.versioning,
    dnsAutoCreated,
    hostedZoneFound, // If true, cert validation records were auto-created by Pulumi
    acmCertificateValidationRecords: outputs.acmCertificateValidationRecords,
  });

  // 14. Track successful deployment
  const duration = Date.now() - startTime;
  const enabledFeatures: string[] = [];
  if (cdnConfig.cdn.enabled) {
    enabledFeatures.push("cdn");
  }
  if (cdnConfig.cdn.customDomain) {
    enabledFeatures.push("custom_domain");
  }
  if (cdnConfig.versioning) {
    enabledFeatures.push("versioning");
  }

  trackServiceInit("cdn", true, {
    preset,
    provider,
    region,
    features: enabledFeatures,
    duration_ms: duration,
  });

  trackServiceDeployed("cdn", {
    duration_ms: duration,
    region,
    features: enabledFeatures,
    preset,
  });
}

/**
 * Display storage deployment success message
 */
function displayCdnSuccess(options: {
  bucketName: string;
  region: string;
  distributionDomain?: string;
  customDomain?: string;
  customDomainPending?: string; // Custom domain awaiting manual cert validation
  roleArn: string;
  versioning: boolean;
  dnsAutoCreated: boolean;
  hostedZoneFound: boolean; // If true, cert validation records were auto-created by Pulumi
  acmCertificateValidationRecords?: Array<{
    name: string;
    type: string;
    value: string;
  }>;
}): void {
  clack.log.success(pc.green(pc.bold("CDN infrastructure deployed!")));

  // Infrastructure summary
  clack.log.info(`\n${pc.bold("Infrastructure:")}`);
  clack.log.info(`  S3 Bucket: ${pc.cyan(options.bucketName)}`);
  clack.log.info(`  Region: ${pc.cyan(options.region)}`);

  if (options.distributionDomain) {
    clack.log.info(
      `  CloudFront: ${pc.cyan(`https://${options.distributionDomain}`)}`
    );
  }

  if (options.customDomain) {
    clack.log.info(
      `  Custom Domain: ${pc.cyan(`https://${options.customDomain}`)}`
    );
  } else if (options.customDomainPending) {
    clack.log.info(
      `  Custom Domain: ${pc.yellow(`${options.customDomainPending} (pending cert validation)`)}`
    );
  }

  clack.log.info(`  IAM Role: ${pc.dim(options.roleArn)}`);
  clack.log.info(
    `  Versioning: ${options.versioning ? pc.green("Enabled") : pc.dim("Disabled")}`
  );

  // DNS records needed for pending custom domain (no Route53 hosted zone)
  if (options.customDomainPending && options.acmCertificateValidationRecords) {
    clack.log.info(`\n${pc.yellow(pc.bold("DNS Records Required:"))}`);
    clack.log.info("Add these records to your DNS provider:\n");

    // Certificate validation records
    clack.log.info(pc.blue("  [1. SSL Certificate Validation]"));
    for (const record of options.acmCertificateValidationRecords) {
      clack.log.info(`  ${pc.cyan(record.type)} ${record.name}`);
      clack.log.info(`  ${pc.dim("→")} ${record.value}\n`);
    }

    // CNAME for custom domain pointing to CloudFront (after cert is validated)
    if (options.distributionDomain) {
      clack.log.info(pc.blue("  [2. CDN Domain - add AFTER cert validation]"));
      clack.log.info(`  ${pc.cyan("CNAME")} ${options.customDomainPending}`);
      clack.log.info(`  ${pc.dim("→")} ${options.distributionDomain}\n`);
    }

    clack.log.warn(
      "Custom domain requires manual setup:\n" +
        "  1. Add the SSL certificate validation DNS record above\n" +
        "  2. Wait for certificate to be validated (check AWS ACM console)\n" +
        "  3. Run 'wraps cdn upgrade' to add custom domain to CloudFront\n" +
        "  4. Add the CDN CNAME record to point your domain to CloudFront"
    );
  }
  // DNS records if custom domain is active but CNAME wasn't auto-created
  else if (
    options.customDomain &&
    !options.dnsAutoCreated &&
    options.distributionDomain
  ) {
    clack.log.info(`\n${pc.yellow(pc.bold("DNS Record Required:"))}`);
    clack.log.info("Add this record to your DNS provider:\n");

    clack.log.info(pc.blue("  [CDN Domain]"));
    clack.log.info(`  ${pc.cyan("CNAME")} ${options.customDomain}`);
    clack.log.info(`  ${pc.dim("→")} ${options.distributionDomain}\n`);
  }

  // Next steps
  clack.log.info(`\n${pc.bold("Next Steps:")}`);
  clack.log.info(`  1. ${pc.cyan("wraps cdn status")} - View your CDN setup`);

  if (options.customDomainPending) {
    clack.log.info("  2. Add DNS records above and validate SSL certificate");
    clack.log.info(
      `  3. ${pc.cyan("wraps cdn upgrade")} - Add custom domain to CloudFront`
    );
  } else if (options.customDomain && !options.dnsAutoCreated) {
    clack.log.info(
      "  2. Add DNS record above to point your domain to CloudFront"
    );
    clack.log.info(
      `  3. ${pc.cyan("wraps cdn verify")} - Check DNS propagation`
    );
  }

  // CDN URL
  const cdnUrl = options.customDomain
    ? `https://${options.customDomain}`
    : options.distributionDomain
      ? `https://${options.distributionDomain}`
      : null;

  if (cdnUrl) {
    clack.log.info(`\n${pc.bold("CDN URL:")}`);
    clack.log.info(`  ${pc.cyan(cdnUrl)}/your-file.jpg`);
  }

  if (options.customDomainPending) {
    clack.outro(
      pc.yellow("CDN deployed! Custom domain pending certificate validation.")
    );
  } else {
    clack.outro(pc.green("CDN is ready!"));
  }
}
