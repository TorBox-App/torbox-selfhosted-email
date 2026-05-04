import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import {
  createSMSEventDestinationWithSDK,
  createSMSPhonePoolWithSDK,
  createSMSProtectConfigurationWithSDK,
  deploySMSStack,
} from "../../infrastructure/sms-stack.js";
import { trackError, trackServiceUpgrade } from "../../telemetry/events.js";
import type {
  ArchiveRetention,
  PhoneNumberType,
  SMSConfigPreset,
  SMSStackConfig,
  SMSStackOutputs,
  SMSUpgradeOptions,
  WrapsSMSConfig,
} from "../../types/index.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import { errors } from "../../utils/shared/errors.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import {
  loadConnectionMetadata,
  saveConnectionMetadata,
  updateServiceConfig,
} from "../../utils/shared/metadata.js";
import {
  DeploymentProgress,
  displayPreview,
} from "../../utils/shared/output.js";
import { promptVercelConfig } from "../../utils/shared/prompts.js";
import {
  ensurePulumiInstalled,
  previewWithResourceChanges,
} from "../../utils/shared/pulumi.js";
import { resolveRegionForCommand } from "../../utils/shared/region-resolver.js";
import {
  calculateSMSCosts,
  formatCost,
  getSMSCostSummary,
} from "../../utils/sms/costs.js";
import { getAllSMSPresetInfo, getSMSPreset } from "../../utils/sms/presets.js";

/**
 * SMS Upgrade command - Enhance existing SMS infrastructure
 */
export async function smsUpgrade(options: SMSUpgradeOptions): Promise<void> {
  const startTime = Date.now();
  let upgradeAction: string | symbol = "";

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps SMS Upgrade - Enhance Your SMS Infrastructure"));
  }

  const progress = new DeploymentProgress();

  // 1. Check Pulumi CLI is installed
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

  // 3. Get region — option → env → saved SMS metadata.
  const region = await resolveRegionForCommand({
    accountId: identity.accountId,
    optionRegion: options.region,
    service: "sms",
    label: "SMS deployment",
  });

  // 4. Load existing connection metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata) {
    clack.log.error(
      `No Wraps connection found for account ${pc.cyan(identity.accountId)} in region ${pc.cyan(region)}`
    );
    clack.log.info(
      `Use ${pc.cyan("wraps sms init")} to create new infrastructure.`
    );
    process.exit(1);
  }

  if (!metadata.services.sms) {
    clack.log.error("No SMS infrastructure found");
    clack.log.info(
      `Use ${pc.cyan("wraps sms init")} to deploy SMS infrastructure.`
    );
    process.exit(1);
  }

  progress.info(`Found existing connection created: ${metadata.timestamp}`);

  // 5. Display current configuration
  console.log(`\n${pc.bold("Current Configuration:")}\n`);

  if (metadata.services.sms.preset) {
    console.log(`  Preset: ${pc.cyan(metadata.services.sms.preset)}`);
  } else {
    console.log(`  Preset: ${pc.cyan("custom")}`);
  }

  const config = metadata.services.sms.config;

  if (!config) {
    clack.log.error("No SMS configuration found in metadata");
    clack.log.info(
      `Use ${pc.cyan("wraps sms init")} to create new infrastructure.`
    );
    process.exit(1);
  }

  // Show phone number type
  if (config.phoneNumberType) {
    const phoneTypeLabels: Record<string, string> = {
      simulator: "Simulator ($1/mo, testing only)",
      "toll-free": "Toll-free ($2/mo, 3 MPS)",
      "10dlc": "10DLC ($2/mo + fees, 75 MPS)",
      "short-code": "Short code ($995+/mo, 100+ MPS)",
    };
    console.log(
      `  Phone Type: ${pc.cyan(phoneTypeLabels[config.phoneNumberType] || config.phoneNumberType)}`
    );
  }

  if (config.tracking?.enabled) {
    console.log(`  ${pc.green("✓")} Delivery Tracking`);
    if (config.tracking.linkTracking) {
      console.log(`    ${pc.dim("└─")} Link click tracking enabled`);
    }
  }

  if (config.eventTracking?.enabled) {
    console.log(`  ${pc.green("✓")} Event Tracking (SNS)`);
    if (config.eventTracking.dynamoDBHistory) {
      console.log(
        `    ${pc.dim("└─")} Message History: ${pc.cyan(config.eventTracking.archiveRetention || "90days")}`
      );
    }
  }

  if (config.messageArchiving?.enabled) {
    console.log(
      `  ${pc.green("✓")} Message Archiving (${config.messageArchiving.retention})`
    );
  }

  if (config.optOutManagement) {
    console.log(`  ${pc.green("✓")} Opt-out Management`);
  }

  if (config.protectConfiguration?.enabled) {
    const countries =
      config.protectConfiguration.allowedCountries?.join(", ") || "US";
    console.log(`  ${pc.green("✓")} Fraud Protection`);
    console.log(`    ${pc.dim("└─")} Allowed countries: ${pc.cyan(countries)}`);
    if (config.protectConfiguration.aitFiltering) {
      console.log(`    ${pc.dim("└─")} AIT filtering: ${pc.cyan("enabled")}`);
    }
  } else {
    console.log(`  ${pc.dim("○")} Fraud Protection (not configured)`);
  }

  // Calculate current cost
  const currentCostData = calculateSMSCosts(config, 10_000);
  console.log(
    `\n  Estimated Cost: ${pc.cyan(`~${formatCost(currentCostData.total.monthly)}/mo`)}`
  );

  console.log("");

  // 6. Prompt for upgrade action
  const phoneTypeLabels: Record<string, string> = {
    simulator: "Simulator",
    "toll-free": "Toll-free",
    "10dlc": "10DLC",
    "short-code": "Short code",
  };

  upgradeAction = await clack.select({
    message: "What would you like to do?",
    options: [
      {
        value: "phone-number",
        label: "Upgrade phone number type",
        hint: `Current: ${phoneTypeLabels[config.phoneNumberType || "simulator"] || config.phoneNumberType}`,
      },
      {
        value: "preset",
        label: "Upgrade to a different preset",
        hint: "Starter → Production → Enterprise",
      },
      {
        value: "event-tracking",
        label: config.eventTracking?.enabled
          ? "Change event tracking settings"
          : "Enable event tracking",
        hint: config.eventTracking?.enabled
          ? "Update retention or disable"
          : "Track SMS events with message history",
      },
      {
        value: "retention",
        label: "Change message history retention",
        hint: "7 days, 30 days, 90 days, 6 months, 1 year",
      },
      {
        value: "link-tracking",
        label: config.tracking?.linkTracking
          ? "Disable link tracking"
          : "Enable link tracking",
        hint: "Track clicks on links in SMS messages",
      },
      {
        value: "archiving",
        label: config.messageArchiving?.enabled
          ? "Change message archiving settings"
          : "Enable message archiving",
        hint: "Store full message content",
      },
      {
        value: "protect",
        label: config.protectConfiguration?.enabled
          ? "Change fraud protection settings"
          : "Enable fraud protection",
        hint: "Block countries, AIT filtering",
      },
    ],
  });

  if (clack.isCancel(upgradeAction)) {
    clack.cancel("Upgrade cancelled.");
    process.exit(0);
  }

  let updatedConfig: WrapsSMSConfig = { ...config };
  let newPreset: string | undefined = metadata.services.sms.preset;

  // 7. Handle upgrade action
  switch (upgradeAction) {
    case "phone-number": {
      const currentType = config.phoneNumberType || "simulator";

      // Build available phone types (exclude current and lower tiers)
      const phoneTypes = [
        {
          value: "simulator",
          label: "Simulator - Testing only",
          hint: "$1/mo, 100 msg/day limit, no real delivery",
          tier: 0,
        },
        {
          value: "toll-free",
          label: "Toll-free - Production ready",
          hint: "$2/mo, 3 MPS, requires registration",
          tier: 1,
        },
        {
          value: "10dlc",
          label: "10DLC - High volume",
          hint: "$2/mo + campaign fees, up to 75 MPS",
          tier: 2,
        },
        {
          value: "short-code",
          label: "Short code - Enterprise",
          hint: "$995+/mo, 100+ MPS, separate application",
          tier: 3,
        },
      ];

      const currentTier =
        phoneTypes.find((p) => p.value === currentType)?.tier || 0;

      const availableTypes = phoneTypes
        .filter((p) => p.tier > currentTier)
        .map((p) => ({
          value: p.value,
          label: p.label,
          hint: p.hint,
        }));

      if (availableTypes.length === 0) {
        clack.log.warn(
          "Already on highest phone number tier. Contact AWS for dedicated short codes."
        );
        process.exit(0);
      }

      const selectedType = await clack.select({
        message: "Select new phone number type:",
        options: availableTypes,
      });

      if (clack.isCancel(selectedType)) {
        clack.cancel("Upgrade cancelled.");
        process.exit(0);
      }

      // Show warnings for toll-free
      if (selectedType === "toll-free") {
        console.log(
          `\n${pc.yellow("⚠")} ${pc.bold("Toll-free Registration Required")}\n`
        );
        console.log(
          pc.dim("Toll-free numbers require carrier registration before")
        );
        console.log(
          pc.dim("they can send messages at scale. After deployment:\n")
        );
        console.log(
          `  1. Run ${pc.cyan("wraps sms register")} to start registration`
        );
        console.log("  2. Submit your business use case information");
        console.log("  3. Wait for carrier verification (1-5 business days)");
        console.log(
          pc.dim("\nUntil verified, sending is limited to low volume.\n")
        );

        const confirmTollFree = await clack.confirm({
          message: "Continue with toll-free number request?",
          initialValue: true,
        });

        if (clack.isCancel(confirmTollFree) || !confirmTollFree) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }
      }

      // Show warnings for 10DLC
      if (selectedType === "10dlc") {
        console.log(
          `\n${pc.yellow("⚠")} ${pc.bold("10DLC Campaign Registration Required")}\n`
        );
        console.log(pc.dim("10DLC requires brand and campaign registration:"));
        console.log("  • Brand registration: one-time $4 fee");
        console.log("  • Campaign registration: $15/mo per campaign");
        console.log("  • Verification takes 1-7 business days");
        console.log("");

        const confirm10DLC = await clack.confirm({
          message: "Continue with 10DLC number request?",
          initialValue: true,
        });

        if (clack.isCancel(confirm10DLC) || !confirm10DLC) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }
      }

      updatedConfig = {
        ...config,
        phoneNumberType: selectedType as PhoneNumberType,
        phoneNumber: undefined, // Will be assigned new number
      };
      newPreset = undefined;
      break;
    }

    case "preset": {
      const presets = getAllSMSPresetInfo();
      const currentPresetIdx = presets.findIndex(
        (p) => p.name.toLowerCase() === metadata.services.sms?.preset
      );

      const availablePresets = presets
        .map((p, idx) => ({
          value: p.name.toLowerCase(),
          label: `${p.name} - ${p.description}`,
          hint: `${p.throughput} | Est. ${p.estimatedCost}`,
          disabled:
            currentPresetIdx >= 0 && idx <= currentPresetIdx
              ? "Current or lower tier"
              : undefined,
        }))
        .filter((p) => !p.disabled && p.value !== "custom");

      if (availablePresets.length === 0) {
        clack.log.warn("Already on highest preset (Enterprise)");
        process.exit(0);
      }

      const selectedPreset = await clack.select({
        message: "Select new preset:",
        options: availablePresets,
      });

      if (clack.isCancel(selectedPreset)) {
        clack.cancel("Upgrade cancelled.");
        process.exit(0);
      }

      const presetConfig = getSMSPreset(selectedPreset as SMSConfigPreset);
      if (presetConfig) {
        // Preserve phone number type if already set (e.g., toll-free shouldn't downgrade to simulator)
        updatedConfig = {
          ...presetConfig,
          phoneNumberType:
            config.phoneNumberType || presetConfig.phoneNumberType,
          phoneNumber: config.phoneNumber,
        };
      }
      newPreset = selectedPreset as string;
      break;
    }

    case "event-tracking": {
      if (config.eventTracking?.enabled) {
        const eventAction = await clack.select({
          message: "What would you like to do with event tracking?",
          options: [
            {
              value: "change-retention",
              label: "Change retention period",
              hint: `Current: ${config.eventTracking.archiveRetention || "90days"}`,
            },
            {
              value: "disable",
              label: "Disable event tracking",
              hint: "Stop tracking SMS events",
            },
          ],
        });

        if (clack.isCancel(eventAction)) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }

        if (eventAction === "disable") {
          const confirmDisable = await clack.confirm({
            message:
              "Are you sure? Existing history will remain, but new events won't be tracked.",
            initialValue: false,
          });

          if (clack.isCancel(confirmDisable) || !confirmDisable) {
            clack.cancel("Event tracking not disabled.");
            process.exit(0);
          }

          updatedConfig = {
            ...config,
            eventTracking: {
              enabled: false,
            },
          };
        } else {
          const retention = await clack.select({
            message: "Message history retention period:",
            options: [
              { value: "7days", label: "7 days", hint: "Minimal storage cost" },
              {
                value: "30days",
                label: "30 days",
                hint: "Development/testing",
              },
              {
                value: "90days",
                label: "90 days (recommended)",
                hint: "Standard retention",
              },
              {
                value: "6months",
                label: "6 months",
                hint: "Extended retention",
              },
              {
                value: "1year",
                label: "1 year",
                hint: "Compliance requirements",
              },
            ],
            initialValue: config.eventTracking.archiveRetention || "90days",
          });

          if (clack.isCancel(retention)) {
            clack.cancel("Upgrade cancelled.");
            process.exit(0);
          }

          updatedConfig = {
            ...config,
            eventTracking: {
              ...config.eventTracking,
              archiveRetention: retention as ArchiveRetention,
            },
          };
        }
      } else {
        const enableTracking = await clack.confirm({
          message: "Enable event tracking? (Track SMS events with history)",
          initialValue: true,
        });

        if (clack.isCancel(enableTracking)) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }

        if (!enableTracking) {
          clack.log.info("Event tracking not enabled.");
          process.exit(0);
        }

        const retention = await clack.select({
          message: "Message history retention period:",
          options: [
            { value: "7days", label: "7 days", hint: "Minimal storage cost" },
            { value: "30days", label: "30 days", hint: "Development/testing" },
            {
              value: "90days",
              label: "90 days (recommended)",
              hint: "Standard retention",
            },
            {
              value: "6months",
              label: "6 months",
              hint: "Extended retention",
            },
            {
              value: "1year",
              label: "1 year",
              hint: "Compliance requirements",
            },
          ],
          initialValue: "90days",
        });

        if (clack.isCancel(retention)) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }

        updatedConfig = {
          ...config,
          eventTracking: {
            enabled: true,
            eventBridge: true,
            events: ["SENT", "DELIVERED", "FAILED", "OPTED_OUT"],
            dynamoDBHistory: true,
            archiveRetention: retention as ArchiveRetention,
          },
        };
      }
      newPreset = undefined;
      break;
    }

    case "retention": {
      if (!config.eventTracking?.enabled) {
        clack.log.error(
          "Event tracking is not enabled. Enable it first to change retention."
        );
        process.exit(1);
      }

      const retention = await clack.select({
        message: "Message history retention period (event data in DynamoDB):",
        options: [
          { value: "7days", label: "7 days", hint: "Minimal storage cost" },
          { value: "30days", label: "30 days", hint: "Development/testing" },
          {
            value: "90days",
            label: "90 days (recommended)",
            hint: "Standard retention",
          },
          { value: "6months", label: "6 months", hint: "Extended retention" },
          {
            value: "1year",
            label: "1 year",
            hint: "Compliance requirements",
          },
        ],
        initialValue: config.eventTracking.archiveRetention || "90days",
      });

      if (clack.isCancel(retention)) {
        clack.cancel("Upgrade cancelled.");
        process.exit(0);
      }

      updatedConfig = {
        ...config,
        eventTracking: {
          ...config.eventTracking,
          enabled: true,
          dynamoDBHistory: true,
          archiveRetention: retention as ArchiveRetention,
        },
      };
      newPreset = undefined;
      break;
    }

    case "link-tracking": {
      const enableLinkTracking = !config.tracking?.linkTracking;

      if (enableLinkTracking) {
        clack.log.info(
          pc.dim(
            "Link tracking will track clicks on URLs in your SMS messages."
          )
        );
        clack.log.info(
          pc.dim("URLs will be rewritten to go through a tracking endpoint.")
        );
      }

      const confirmed = await clack.confirm({
        message: enableLinkTracking
          ? "Enable link click tracking?"
          : "Disable link click tracking?",
        initialValue: enableLinkTracking,
      });

      if (clack.isCancel(confirmed) || !confirmed) {
        clack.cancel("Upgrade cancelled.");
        process.exit(0);
      }

      updatedConfig = {
        ...config,
        tracking: {
          ...config.tracking,
          enabled: true,
          deliveryReports: config.tracking?.deliveryReports ?? true,
          linkTracking: enableLinkTracking,
        },
      };
      newPreset = undefined;
      break;
    }

    case "archiving": {
      if (config.messageArchiving?.enabled) {
        const archivingAction = await clack.select({
          message: "What would you like to do with message archiving?",
          options: [
            {
              value: "change-retention",
              label: "Change retention period",
              hint: `Current: ${config.messageArchiving.retention}`,
            },
            {
              value: "disable",
              label: "Disable message archiving",
              hint: "Stop storing full message content",
            },
          ],
        });

        if (clack.isCancel(archivingAction)) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }

        if (archivingAction === "disable") {
          const confirmDisable = await clack.confirm({
            message:
              "Are you sure? Existing archived messages will remain, but new messages won't be archived.",
            initialValue: false,
          });

          if (clack.isCancel(confirmDisable) || !confirmDisable) {
            clack.cancel("Archiving not disabled.");
            process.exit(0);
          }

          updatedConfig = {
            ...config,
            messageArchiving: {
              enabled: false,
              retention: config.messageArchiving.retention,
            },
          };
        } else {
          const retention = await clack.select({
            message: "Message archive retention period:",
            options: [
              {
                value: "7days",
                label: "7 days",
                hint: "~$1-2/mo for 10k msgs",
              },
              {
                value: "30days",
                label: "30 days",
                hint: "~$2-4/mo for 10k msgs",
              },
              {
                value: "90days",
                label: "90 days (recommended)",
                hint: "~$5-10/mo for 10k msgs",
              },
              {
                value: "6months",
                label: "6 months",
                hint: "~$15-25/mo for 10k msgs",
              },
              {
                value: "1year",
                label: "1 year",
                hint: "~$25-40/mo for 10k msgs",
              },
            ],
            initialValue: config.messageArchiving.retention,
          });

          if (clack.isCancel(retention)) {
            clack.cancel("Upgrade cancelled.");
            process.exit(0);
          }

          updatedConfig = {
            ...config,
            messageArchiving: {
              enabled: true,
              retention: retention as ArchiveRetention,
            },
          };
        }
      } else {
        const enableArchiving = await clack.confirm({
          message:
            "Enable message archiving? (Store full message content for viewing)",
          initialValue: true,
        });

        if (clack.isCancel(enableArchiving)) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }

        if (!enableArchiving) {
          clack.log.info("Message archiving not enabled.");
          process.exit(0);
        }

        const retention = await clack.select({
          message: "Message archive retention period:",
          options: [
            { value: "7days", label: "7 days", hint: "~$1-2/mo for 10k msgs" },
            {
              value: "30days",
              label: "30 days",
              hint: "~$2-4/mo for 10k msgs",
            },
            {
              value: "90days",
              label: "90 days (recommended)",
              hint: "~$5-10/mo for 10k msgs",
            },
            {
              value: "6months",
              label: "6 months",
              hint: "~$15-25/mo for 10k msgs",
            },
            {
              value: "1year",
              label: "1 year",
              hint: "~$25-40/mo for 10k msgs",
            },
          ],
          initialValue: "90days",
        });

        if (clack.isCancel(retention)) {
          clack.cancel("Upgrade cancelled.");
          process.exit(0);
        }

        updatedConfig = {
          ...config,
          messageArchiving: {
            enabled: true,
            retention: retention as ArchiveRetention,
          },
        };
      }
      newPreset = undefined;
      break;
    }

    case "protect": {
      // Common countries for selection
      const commonCountries = [
        { code: "US", name: "United States" },
        { code: "CA", name: "Canada" },
        { code: "GB", name: "United Kingdom" },
        { code: "AU", name: "Australia" },
        { code: "DE", name: "Germany" },
        { code: "FR", name: "France" },
        { code: "ES", name: "Spain" },
        { code: "IT", name: "Italy" },
        { code: "NL", name: "Netherlands" },
        { code: "BR", name: "Brazil" },
        { code: "MX", name: "Mexico" },
        { code: "IN", name: "India" },
      ];

      // Select allowed countries
      const currentAllowed = config.protectConfiguration?.allowedCountries || [
        "US",
      ];
      const selectedCountries = await clack.multiselect({
        message: "Select countries to allow SMS delivery (all others blocked):",
        options: commonCountries.map((c) => ({
          value: c.code,
          label: `${c.name} (${c.code})`,
        })),
        initialValues: currentAllowed,
        required: true,
      });

      if (clack.isCancel(selectedCountries)) {
        clack.cancel("Upgrade cancelled.");
        process.exit(0);
      }

      // Ask about AIT filtering
      const enableAIT = await clack.confirm({
        message:
          "Enable AIT (Artificially Inflated Traffic) filtering? (adds per-message cost)",
        initialValue: config.protectConfiguration?.aitFiltering ?? false,
      });

      if (clack.isCancel(enableAIT)) {
        clack.cancel("Upgrade cancelled.");
        process.exit(0);
      }

      updatedConfig = {
        ...config,
        protectConfiguration: {
          enabled: true,
          allowedCountries: selectedCountries as string[],
          aitFiltering: enableAIT,
        },
      };
      newPreset = undefined;
      break;
    }
  }

  // 8. Show cost comparison
  const newCostData = calculateSMSCosts(updatedConfig, 10_000);
  const costDiff = newCostData.total.monthly - currentCostData.total.monthly;

  console.log(`\n${pc.bold("Cost Impact:")}`);
  console.log(
    `  Current: ${pc.cyan(`${formatCost(currentCostData.total.monthly)}/mo`)}`
  );
  console.log(
    `  New:     ${pc.cyan(`${formatCost(newCostData.total.monthly)}/mo`)}`
  );
  if (costDiff > 0) {
    console.log(`  Change:  ${pc.yellow(`+${formatCost(costDiff)}/mo`)}`);
  } else if (costDiff < 0) {
    console.log(
      `  Change:  ${pc.green(`-${formatCost(Math.abs(costDiff))}/mo`)}`
    );
  }
  console.log("");

  // 9. Confirm upgrade (skip if --yes or --preview)
  if (!(options.yes || options.preview)) {
    const confirmed = await clack.confirm({
      message: "Proceed with upgrade?",
      initialValue: true,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Upgrade cancelled.");
      process.exit(0);
    }
  }

  // 10. Get Vercel config if needed and not already stored
  let vercelConfig;
  if (metadata.provider === "vercel" && !metadata.vercel) {
    vercelConfig = await promptVercelConfig();
  } else if (metadata.provider === "vercel") {
    vercelConfig = metadata.vercel;
  }

  // 11. Build stack configuration
  const stackConfig: SMSStackConfig = {
    provider: metadata.provider,
    region,
    vercel: vercelConfig,
    smsConfig: updatedConfig,
  };

  const stackName =
    metadata.services.sms?.pulumiStackName ||
    `wraps-sms-${identity.accountId}-${region}`;

  // 11a. Helper to create the Pulumi stack (shared between preview and deploy)
  const createStack = async () => {
    await ensurePulumiWorkDir({ accountId: identity.accountId, region });
    const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
      {
        stackName,
        projectName: "wraps-sms",
        program: async () => {
          const result = await deploySMSStack(stackConfig);
          return {
            roleArn: result.roleArn,
            phoneNumber: result.phoneNumber,
            phoneNumberArn: result.phoneNumberArn,
            configSetName: result.configSetName,
            tableName: result.tableName,
            region: result.region,
            lambdaFunctions: result.lambdaFunctions,
            snsTopicArn: result.snsTopicArn,
            queueUrl: result.queueUrl,
            dlqUrl: result.dlqUrl,
            optOutListArn: result.optOutListArn,
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
    await stack.workspace.selectStack(stackName);
    await stack.setConfig("aws:region", { value: region });
    return stack;
  };

  // 12. Preview mode — show what would change without deploying
  if (options.preview) {
    try {
      const previewResult = await progress.execute(
        "Generating infrastructure preview",
        async () => {
          const stack = await createStack();
          await stack.refresh({ onOutput: () => {} });
          return previewWithResourceChanges(stack, { diff: true });
        }
      );
      displayPreview({
        changeSummary: previewResult.changeSummary,
        resourceChanges: previewResult.resourceChanges,
        commandName: "wraps sms upgrade",
      });
      clack.outro(
        pc.green("Preview complete. Run without --preview to upgrade.")
      );
      trackServiceUpgrade("sms", {
        region,
        preview: true,
        duration_ms: Date.now() - startTime,
      });
    } catch (error) {
      trackError("PREVIEW_FAILED", "sms:upgrade", { step: "preview" });
      throw error;
    }
    return;
  }

  // 12. Update Pulumi stack
  let outputs: SMSStackOutputs;
  try {
    outputs = await progress.execute(
      "Updating SMS infrastructure (this may take 2-3 minutes)",
      async () => {
        const stack = await createStack();

        // Refresh state to sync with AWS before upgrading
        await stack.refresh({ onOutput: () => {} });

        // Pulumi will automatically detect changes and only update what's needed
        const upResult = await stack.up({ onOutput: () => {} });
        const pulumiOutputs = upResult.outputs;

        return {
          roleArn: pulumiOutputs.roleArn?.value as string,
          phoneNumber: pulumiOutputs.phoneNumber?.value as string | undefined,
          phoneNumberArn: pulumiOutputs.phoneNumberArn?.value as
            | string
            | undefined,
          configSetName: pulumiOutputs.configSetName?.value as
            | string
            | undefined,
          tableName: pulumiOutputs.tableName?.value as string | undefined,
          region: pulumiOutputs.region?.value as string,
          lambdaFunctions: pulumiOutputs.lambdaFunctions?.value as
            | string[]
            | undefined,
          snsTopicArn: pulumiOutputs.snsTopicArn?.value as string | undefined,
          queueUrl: pulumiOutputs.queueUrl?.value as string | undefined,
          dlqUrl: pulumiOutputs.dlqUrl?.value as string | undefined,
          optOutListArn: pulumiOutputs.optOutListArn?.value as
            | string
            | undefined,
        };
      }
    );

    // 12a. Create phone pool via SDK (after Pulumi deployment)
    if (outputs.phoneNumberArn) {
      await progress.execute("Creating phone pool", async () => {
        await createSMSPhonePoolWithSDK(outputs.phoneNumberArn!, region);
      });
    }

    // 12b. Create event destination via SDK (after Pulumi deployment)
    if (
      updatedConfig.eventTracking?.enabled &&
      outputs.configSetName &&
      outputs.snsTopicArn
    ) {
      await progress.execute("Configuring event destination", async () => {
        await createSMSEventDestinationWithSDK(
          outputs.configSetName!,
          outputs.snsTopicArn!,
          region
        );
      });
    }

    // 12c. Update protect configuration via SDK
    if (updatedConfig.protectConfiguration?.enabled && outputs.configSetName) {
      await progress.execute("Updating fraud protection", async () => {
        await createSMSProtectConfigurationWithSDK(
          outputs.configSetName!,
          region,
          {
            allowedCountries:
              updatedConfig.protectConfiguration?.allowedCountries,
            aitFiltering: updatedConfig.protectConfiguration?.aitFiltering,
          }
        );
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    trackServiceUpgrade("sms", {
      from_preset: metadata.services.sms?.preset,
      to_preset: newPreset,
      action: typeof upgradeAction === "string" ? upgradeAction : undefined,
      duration_ms: Date.now() - startTime,
    });

    if (msg.includes("stack is currently locked")) {
      trackError("STACK_LOCKED", "sms:upgrade", { step: "deploy" });
      throw errors.stackLocked();
    }

    trackError("UPGRADE_FAILED", "sms:upgrade", { step: "deploy" });
    throw new Error(`SMS upgrade failed: ${msg}`);
  }

  // 13. Update metadata
  updateServiceConfig(metadata, "sms", updatedConfig);
  if (metadata.services.sms) {
    metadata.services.sms.preset = newPreset as SMSConfigPreset;
  }
  await saveConnectionMetadata(metadata);

  if (isJsonMode()) {
    jsonSuccess("sms.upgrade", {
      upgraded: true,
      region: outputs.region,
      action: typeof upgradeAction === "string" ? upgradeAction : undefined,
      preset: newPreset,
      roleArn: outputs.roleArn,
      phoneNumber: outputs.phoneNumber,
      configSetName: outputs.configSetName,
    });
    trackServiceUpgrade("sms", {
      from_preset: metadata.services.sms?.preset,
      to_preset: newPreset,
      action: typeof upgradeAction === "string" ? upgradeAction : undefined,
      duration_ms: Date.now() - startTime,
    });
    return;
  }

  progress.info("Connection metadata updated");

  // 14. Display success message
  console.log("\n");
  clack.log.success(pc.green(pc.bold("SMS infrastructure upgraded!")));
  console.log("\n");

  // Show updated resources
  clack.note(
    [
      `${pc.bold("Phone Number:")} ${pc.cyan(outputs.phoneNumber || "Provisioning...")}`,
      `${pc.bold("Phone Type:")} ${pc.cyan(updatedConfig.phoneNumberType || "simulator")}`,
      `${pc.bold("Config Set:")} ${pc.cyan(outputs.configSetName || "wraps-sms-config")}`,
      `${pc.bold("Region:")} ${pc.cyan(outputs.region)}`,
      outputs.tableName
        ? `${pc.bold("History Table:")} ${pc.cyan(outputs.tableName)}`
        : "",
      "",
      pc.dim("IAM Role:"),
      pc.dim(`  ${outputs.roleArn}`),
    ]
      .filter(Boolean)
      .join("\n"),
    "SMS Infrastructure"
  );

  // Show what was upgraded
  console.log(`\n${pc.green("✓")} ${pc.bold("Upgrade complete!")}\n`);

  if (upgradeAction === "phone-number") {
    console.log(
      `Upgraded to ${pc.cyan(updatedConfig.phoneNumberType)} number (${pc.green(`${formatCost(newCostData.total.monthly)}/mo`)})\n`
    );

    // Show next steps for toll-free registration
    if (updatedConfig.phoneNumberType === "toll-free") {
      console.log(`${pc.bold("Next Steps:")}`);
      console.log(
        `  1. Run ${pc.cyan("wraps sms register")} to start toll-free registration`
      );
      console.log("  2. Submit your business information and use case");
      console.log("  3. Wait for carrier verification (1-5 business days)");
      console.log("");
      console.log(
        pc.dim("Until verified, your number can only send limited messages.")
      );
      console.log("");
    } else if (updatedConfig.phoneNumberType === "10dlc") {
      console.log(`${pc.bold("Next Steps:")}`);
      console.log("  1. Register your brand in the AWS Console");
      console.log("  2. Create a 10DLC campaign for your use case");
      console.log("  3. Wait for campaign approval (1-7 business days)");
      console.log("");
    }
  } else if (upgradeAction === "preset" && newPreset) {
    console.log(
      `Upgraded to ${pc.cyan(newPreset)} preset (${pc.green(`${formatCost(newCostData.total.monthly)}/mo`)})\n`
    );
  } else {
    console.log(
      `Updated configuration (${pc.green(`${formatCost(newCostData.total.monthly)}/mo`)})\n`
    );
  }

  // Show cost summary
  console.log(pc.dim(getSMSCostSummary(updatedConfig, 10_000)));

  // 15. Track successful upgrade
  const enabledFeatures: string[] = [];
  if (updatedConfig.tracking?.enabled) {
    enabledFeatures.push("tracking");
  }
  if (updatedConfig.tracking?.linkTracking) {
    enabledFeatures.push("link_tracking");
  }
  if (updatedConfig.eventTracking?.enabled) {
    enabledFeatures.push("event_tracking");
  }
  if (updatedConfig.eventTracking?.dynamoDBHistory) {
    enabledFeatures.push("dynamodb_history");
  }
  if (updatedConfig.messageArchiving?.enabled) {
    enabledFeatures.push("message_archiving");
  }

  trackServiceUpgrade("sms", {
    from_preset: metadata.services.sms?.preset,
    to_preset: newPreset,
    added_features: enabledFeatures,
    action: typeof upgradeAction === "string" ? upgradeAction : undefined,
    duration_ms: Date.now() - startTime,
  });

  clack.outro(pc.green("Upgrade complete!"));
}
