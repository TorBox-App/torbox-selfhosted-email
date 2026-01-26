#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as clack from "@clack/prompts";
import args from "args";
import pc from "picocolors";
// AWS commands
import { doctor as awsDoctor } from "./commands/aws/doctor.js";
import { setup as awsSetup } from "./commands/aws/setup.js";
// CDN commands
import { cdnDestroy } from "./commands/cdn/destroy.js";
import { init as cdnInit } from "./commands/cdn/init.js";
import { cdnStatus } from "./commands/cdn/status.js";
import { cdnSync } from "./commands/cdn/sync.js";
import { cdnUpgrade } from "./commands/cdn/upgrade.js";
import { cdnVerify } from "./commands/cdn/verify.js";
// Email commands
import { check } from "./commands/email/check.js";
import { config } from "./commands/email/config.js";
import { connect } from "./commands/email/connect.js";
import { emailDestroy } from "./commands/email/destroy.js";
import {
  addDomain,
  getDkim,
  listDomains,
  removeDomain,
  verifyDomain,
} from "./commands/email/domains.js";
import { init } from "./commands/email/init.js";
import { restore } from "./commands/email/restore.js";
import { emailStatus } from "./commands/email/status.js";
import { upgrade } from "./commands/email/upgrade.js";
// Info commands
import { news } from "./commands/news.js";
import { permissions } from "./commands/permissions.js";
// Platform commands
import { platform as platformInfo } from "./commands/platform/index.js";
import { updateRole } from "./commands/platform/update-role.js";
// Shared commands
import { dashboard } from "./commands/shared/dashboard.js";
import { destroy } from "./commands/shared/destroy.js";
import { status } from "./commands/shared/status.js";
// SMS commands
import { smsDestroy } from "./commands/sms/destroy.js";
import { init as smsInit } from "./commands/sms/init.js";
import { smsRegister } from "./commands/sms/register.js";
import { smsStatus } from "./commands/sms/status.js";
import { smsSync } from "./commands/sms/sync.js";
import { smsTest } from "./commands/sms/test.js";
import { smsUpgrade } from "./commands/sms/upgrade.js";
import { smsVerifyNumber } from "./commands/sms/verify-number.js";
import { support } from "./commands/support.js";
// Telemetry commands
import {
  telemetryDisable,
  telemetryEnable,
  telemetryStatus,
} from "./commands/telemetry.js";
import { getTelemetryClient } from "./telemetry/client.js";
import { trackCommand } from "./telemetry/events.js";
import {
  printCompletionScript,
  setupTabCompletion,
} from "./utils/shared/completion.js";
import { handleCLIError } from "./utils/shared/errors.js";

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8")
);
const VERSION = packageJson.version;

// Setup tab completion
setupTabCompletion();

// Function to show version
function showVersion() {
  console.log(`wraps v${VERSION}`);
  process.exit(0);
}

// Function to show help
function showHelp() {
  clack.intro(pc.bold(`WRAPS CLI v${VERSION}`));
  console.log("Deploy AWS infrastructure to your account\n");
  console.log("Usage: wraps [service] <command> [options]\n");
  console.log("Services:");
  console.log(`  ${pc.cyan("email")}       Email infrastructure (AWS SES)`);
  console.log(
    `  ${pc.cyan("sms")}         SMS infrastructure (AWS End User Messaging)`
  );
  console.log(
    `  ${pc.cyan("cdn")}         CDN infrastructure (AWS S3 + CloudFront)\n`
  );
  console.log("Email Commands:");
  console.log(
    `  ${pc.cyan("email init")}           Deploy new email infrastructure`
  );
  console.log(
    `  ${pc.cyan("email check")}          Check email deliverability for a domain`
  );
  console.log(
    `  ${pc.cyan("email connect")}        Connect to existing AWS SES`
  );
  console.log(
    `  ${pc.cyan("email status")}         Show email infrastructure details`
  );
  console.log(`  ${pc.cyan("email verify")}         Verify domain DNS records`);
  console.log(
    `  ${pc.cyan("email sync")}           Apply CLI updates to infrastructure`
  );
  console.log(`  ${pc.cyan("email upgrade")}        Add features`);
  console.log(
    `  ${pc.cyan("email restore")}        Restore original configuration`
  );
  console.log(
    `  ${pc.cyan("email destroy")}        Remove email infrastructure`
  );
  console.log(`  ${pc.cyan("email domains add")}    Add a domain to SES`);
  console.log(`  ${pc.cyan("email domains list")}   List all domains`);
  console.log(`  ${pc.cyan("email domains remove")} Remove a domain\n`);
  console.log("SMS Commands:");
  console.log(`  ${pc.cyan("sms init")}             Deploy SMS infrastructure`);
  console.log(
    `  ${pc.cyan("sms status")}           Show SMS infrastructure details`
  );
  console.log(`  ${pc.cyan("sms test")}             Send a test SMS message`);
  console.log(
    `  ${pc.cyan("sms verify-number")}    Verify a destination phone number`
  );
  console.log(
    `  ${pc.cyan("sms sync")}             Sync infrastructure (update Lambda, etc.)`
  );
  console.log(`  ${pc.cyan("sms upgrade")}          Upgrade SMS features`);
  console.log(`  ${pc.cyan("sms register")}         Register toll-free number`);
  console.log(
    `  ${pc.cyan("sms destroy")}          Remove SMS infrastructure\n`
  );
  console.log("CDN Commands:");
  console.log(
    `  ${pc.cyan("cdn init")}             Deploy CDN infrastructure (S3 + CloudFront)`
  );
  console.log(
    `  ${pc.cyan("cdn status")}           Show CDN infrastructure details`
  );
  console.log(
    `  ${pc.cyan("cdn verify")}           Check DNS and certificate status`
  );
  console.log(
    `  ${pc.cyan("cdn upgrade")}          Add custom domain after cert validation`
  );
  console.log(
    `  ${pc.cyan("cdn sync")}             Sync infrastructure with current config`
  );
  console.log(
    `  ${pc.cyan("cdn destroy")}          Remove CDN infrastructure\n`
  );
  console.log("Local Development:");
  console.log(
    `  ${pc.cyan("console")}               Start local web console\n`
  );
  console.log("Platform:");
  console.log(
    `  ${pc.cyan("platform")}              Show platform info and pricing`
  );
  console.log(
    `  ${pc.cyan("platform update-role")} Update platform IAM permissions\n`
  );
  console.log("AWS Setup:");
  console.log(
    `  ${pc.cyan("aws setup")}            Interactive AWS setup wizard`
  );
  console.log(
    `  ${pc.cyan("aws doctor")}           Diagnose AWS configuration issues\n`
  );
  console.log("Global Commands:");
  console.log(`  ${pc.cyan("status")}       Show overview of all services`);
  console.log(`  ${pc.cyan("destroy")}      Remove deployed infrastructure`);
  console.log(`  ${pc.cyan("permissions")} Show required AWS IAM permissions`);
  console.log(`  ${pc.cyan("completion")}   Generate shell completion script`);
  console.log(
    `  ${pc.cyan("telemetry")}    Manage anonymous telemetry settings`
  );
  console.log(`  ${pc.cyan("news")}         Show recent Wraps updates`);
  console.log(
    `  ${pc.cyan("support")}      Get help and support contact info\n`
  );
  console.log("Options:");
  console.log(
    `  ${pc.dim("-p, --provider")}  Hosting provider (vercel, aws, railway, other)`
  );
  console.log(`  ${pc.dim("-r, --region")}    AWS region`);
  console.log(`  ${pc.dim("-d, --domain")}    Domain name`);
  console.log(`  ${pc.dim("--account")}        AWS account ID or alias`);
  console.log(`  ${pc.dim("--preset")}         Configuration preset`);
  console.log(`  ${pc.dim("-y, --yes")}        Skip confirmation prompts`);
  console.log(`  ${pc.dim("-f, --force")}      Force destructive operations`);
  console.log(
    `  ${pc.dim("--preview")}        Preview changes without deploying`
  );
  console.log(`  ${pc.dim("-v, --version")}    Show version number\n`);
  console.log(
    `Run ${pc.cyan("wraps <service> <command> --help")} for more information.\n`
  );
  process.exit(0);
}

// Check for version before args parses
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  showVersion();
}

// Check for help before args parses (to override args' built-in help)
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  showHelp();
}

// Configure args
args.options([
  {
    name: ["p", "provider"],
    description: "Hosting provider (vercel, aws, railway, other)",
    defaultValue: undefined,
  },
  {
    name: ["r", "region"],
    description: "AWS region",
    defaultValue: undefined,
  },
  {
    name: ["d", "domain"],
    description: "Domain name",
    defaultValue: undefined,
  },
  {
    name: "account",
    description: "AWS account ID or alias",
    defaultValue: undefined,
  },
  {
    name: "preset",
    description:
      "Configuration preset (starter, production, enterprise, custom)",
    defaultValue: undefined,
  },
  {
    name: ["y", "yes"],
    description: "Skip confirmation prompts (non-destructive operations)",
    defaultValue: false,
  },
  {
    name: ["f", "force"],
    description:
      "Force operation without confirmation (destructive operations)",
    defaultValue: false,
  },
  {
    name: "port",
    description: "Port for dashboard server",
    defaultValue: undefined,
  },
  {
    name: "noOpen",
    description: "Don't open browser automatically",
    defaultValue: false,
  },
  {
    name: "preview",
    description: "Preview changes without deploying",
    defaultValue: false,
  },
  // SMS-specific options
  {
    name: "to",
    description: "Destination phone number (E.164 format)",
    defaultValue: undefined,
  },
  {
    name: "message",
    description: "SMS message content",
    defaultValue: undefined,
  },
  // SMS verify-number options
  {
    name: "phoneNumber",
    description: "Phone number to verify (E.164 format)",
    defaultValue: undefined,
  },
  {
    name: "code",
    description: "Verification code received via SMS",
    defaultValue: undefined,
  },
  {
    name: "list",
    description: "List all verified destination numbers",
    defaultValue: false,
  },
  {
    name: "delete",
    description: "Delete a verified destination number",
    defaultValue: false,
  },
  {
    name: "resend",
    description: "Resend verification code",
    defaultValue: false,
  },
  // Email check options
  {
    name: ["q", "quick"],
    description: "Quick mode: fewer DKIM selectors, top blacklists only",
    defaultValue: false,
  },
  {
    name: ["j", "json"],
    description: "Output results as JSON",
    defaultValue: false,
  },
  {
    name: "verbose",
    description: "Show all checks including passing",
    defaultValue: false,
  },
  {
    name: "dkimSelector",
    description: "Specific DKIM selector to check",
    defaultValue: undefined,
  },
  {
    name: "skipBlacklists",
    description: "Skip blacklist checks",
    defaultValue: false,
  },
  {
    name: "skipTls",
    description: "Skip MX TLS checks",
    defaultValue: false,
  },
  {
    name: "timeout",
    description: "DNS timeout in milliseconds",
    defaultValue: undefined,
  },
  // Permissions command options
  {
    name: "service",
    description: "Service type for permissions (email, sms, cdn)",
    defaultValue: undefined,
  },
]);

// Get command and flags
const flags = args.parse(process.argv);
const [primaryCommand, subCommand] = args.sub;

// If no command provided, show interactive menu
if (!primaryCommand) {
  async function interactiveMenu() {
    clack.intro(pc.bold(`WRAPS CLI v${VERSION}`));
    console.log("  Deploy AWS infrastructure to your account.\n");

    const action = await clack.select({
      message: "What would you like to do?",
      options: [
        {
          value: "email-init",
          label: "Deploy Email",
          hint: "AWS SES with tracking & analytics",
        },
        {
          value: "sms-init",
          label: "Deploy SMS",
          hint: "AWS End User Messaging",
        },
        {
          value: "cdn-init",
          label: "Deploy CDN",
          hint: "AWS S3 + CloudFront CDN",
        },
        {
          value: "status",
          label: "View Status",
          hint: "Check deployed infrastructure",
        },
        {
          value: "console",
          label: "Local Console",
          hint: "Start web dashboard locally",
        },
        {
          value: "platform",
          label: "Wraps Platform",
          hint: "Templates, broadcasts, automations",
        },
        {
          value: "news",
          label: "What's New",
          hint: "Recent updates & changelog",
        },
        {
          value: "support",
          label: "Get Help",
          hint: "Contact & documentation",
        },
        {
          value: "help",
          label: "All Commands",
          hint: "Show CLI reference",
        },
      ],
    });

    if (clack.isCancel(action)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }

    switch (action) {
      case "email-init":
        await init({
          provider: flags.provider,
          region: flags.region,
          domain: flags.domain,
          preset: flags.preset,
          yes: flags.yes,
          preview: flags.preview,
        });
        break;
      case "sms-init":
        await smsInit({
          provider: flags.provider,
          region: flags.region,
          preset: flags.preset,
          yes: flags.yes,
        });
        break;
      case "cdn-init":
        await cdnInit({
          provider: flags.provider,
          region: flags.region,
          preset: flags.preset,
          yes: flags.yes,
          preview: flags.preview,
        });
        break;
      case "status":
        await status({ account: flags.account });
        break;
      case "console":
        await dashboard({ port: flags.port, noOpen: flags.noOpen });
        break;
      case "platform":
        await platformInfo();
        break;
      case "news":
        await news();
        break;
      case "support":
        await support();
        break;
      case "help":
        showHelp();
        break;
    }
  }

  // Run interactive menu and exit when done
  interactiveMenu()
    .then(() => process.exit(0))
    .catch((err) => {
      handleCLIError(err);
      process.exit(1);
    });
}

// Route to appropriate command (only runs if primaryCommand exists)
async function run() {
  const startTime = Date.now();
  const telemetry = getTelemetryClient();

  // Show first-run telemetry notification
  if (telemetry.shouldShowNotification()) {
    console.log();
    clack.log.info(pc.bold("Anonymous Telemetry"));
    console.log(
      `  Wraps collects ${pc.cyan("anonymous usage data")} to improve the CLI.`
    );
    console.log(
      `  We ${pc.bold("never")} collect: domains, AWS credentials, email content, or PII.`
    );
    console.log(
      `  We ${pc.bold("only")} collect: command names, success/failure, CLI version, OS.`
    );
    console.log();
    console.log(`  Opt-out anytime: ${pc.cyan("wraps telemetry disable")}`);
    console.log(`  Or set: ${pc.cyan("WRAPS_TELEMETRY_DISABLED=1")}`);
    console.log(`  Learn more: ${pc.cyan("https://wraps.dev/docs")}`);
    console.log();

    telemetry.markNotificationShown();
  }

  try {
    // Handle service-specific subcommands (e.g., wraps email init)
    if (primaryCommand === "email" && subCommand) {
      switch (subCommand) {
        case "init":
          await init({
            provider: flags.provider,
            region: flags.region,
            domain: flags.domain,
            preset: flags.preset,
            yes: flags.yes,
            preview: flags.preview,
          });
          break;

        case "check":
          // Domain can be positional arg or --domain flag
          await check({
            domain: args.sub[2] || flags.domain,
            quick: flags.quick,
            json: flags.json,
            verbose: flags.verbose,
            dkimSelector: flags.dkimSelector,
            skipBlacklists: flags.skipBlacklists,
            skipTls: flags.skipTls,
            timeout: flags.timeout,
          });
          break;

        case "connect":
          await connect({
            provider: flags.provider,
            region: flags.region,
            yes: flags.yes,
            preview: flags.preview,
          });
          break;

        case "config":
        case "sync":
          await config({
            region: flags.region,
            yes: flags.yes,
            preview: flags.preview,
          });
          break;

        case "upgrade":
          await upgrade({
            region: flags.region,
            yes: flags.yes,
            preview: flags.preview,
          });
          break;

        case "restore":
          await restore({
            region: flags.region,
            force: flags.force,
            preview: flags.preview,
          });
          break;

        case "status":
          await emailStatus({
            account: flags.account,
            region: flags.region,
          });
          break;

        case "verify": {
          if (!flags.domain) {
            clack.log.error("--domain flag is required");
            console.log(
              `\nUsage: ${pc.cyan("wraps email verify --domain yourapp.com")}\n`
            );
            process.exit(1);
          }
          await verifyDomain({ domain: flags.domain });
          break;
        }

        case "domains": {
          // Handle domains subcommands
          const domainsSubCommand = args.sub[2];

          switch (domainsSubCommand) {
            case "add": {
              if (!flags.domain) {
                clack.log.error("--domain flag is required");
                console.log(
                  `\nUsage: ${pc.cyan("wraps email domains add --domain yourapp.com")}\n`
                );
                process.exit(1);
              }
              await addDomain({ domain: flags.domain });
              break;
            }

            case "list":
              await listDomains();
              break;

            case "verify": {
              if (!flags.domain) {
                clack.log.error("--domain flag is required");
                console.log(
                  `\nUsage: ${pc.cyan("wraps email domains verify --domain yourapp.com")}\n`
                );
                process.exit(1);
              }
              await verifyDomain({ domain: flags.domain });
              break;
            }

            case "get-dkim": {
              if (!flags.domain) {
                clack.log.error("--domain flag is required");
                console.log(
                  `\nUsage: ${pc.cyan("wraps email domains get-dkim --domain yourapp.com")}\n`
                );
                process.exit(1);
              }
              await getDkim({ domain: flags.domain });
              break;
            }

            case "remove": {
              if (!flags.domain) {
                clack.log.error("--domain flag is required");
                console.log(
                  `\nUsage: ${pc.cyan("wraps email domains remove --domain yourapp.com --force")}\n`
                );
                process.exit(1);
              }
              await removeDomain({
                domain: flags.domain,
                force: flags.force,
              });
              break;
            }

            default:
              clack.log.error(
                `Unknown domains command: ${domainsSubCommand || "(none)"}`
              );
              console.log(
                `\nAvailable commands: ${pc.cyan("add")}, ${pc.cyan("list")}, ${pc.cyan("verify")}, ${pc.cyan("get-dkim")}, ${pc.cyan("remove")}\n`
              );
              process.exit(1);
          }
          break;
        }

        case "destroy":
          await emailDestroy({
            force: flags.force,
            region: flags.region,
            preview: flags.preview,
          });
          break;

        default:
          clack.log.error(`Unknown email command: ${subCommand}`);
          console.log(
            `\nRun ${pc.cyan("wraps --help")} for available commands.\n`
          );
          process.exit(1);
      }
      // Track email commands (they return early, so track here)
      const emailDuration = Date.now() - startTime;
      const emailCommandName = `email:${subCommand}`;
      trackCommand(emailCommandName, {
        success: true,
        duration_ms: emailDuration,
        service: "email",
      });
      return;
    }

    // Handle SMS subcommands (e.g., wraps sms init)
    if (primaryCommand === "sms" && subCommand) {
      switch (subCommand) {
        case "init":
          await smsInit({
            provider: flags.provider,
            region: flags.region,
            preset: flags.preset,
            yes: flags.yes,
          });
          break;

        case "status":
          await smsStatus({
            account: flags.account,
          });
          break;

        case "test":
          await smsTest({
            to: flags.to,
            message: flags.message,
          });
          break;

        case "upgrade":
          await smsUpgrade({
            region: flags.region,
            yes: flags.yes,
          });
          break;

        case "sync":
          await smsSync({
            region: flags.region,
            yes: flags.yes,
          });
          break;

        case "destroy":
          await smsDestroy({
            force: flags.force,
            preview: flags.preview,
          });
          break;

        case "verify-number":
          await smsVerifyNumber({
            phoneNumber: flags.phoneNumber,
            code: flags.code,
            list: flags.list,
            delete: flags.delete,
            resend: flags.resend,
          });
          break;

        case "register":
          await smsRegister({
            region: flags.region,
          });
          break;

        default:
          clack.log.error(`Unknown sms command: ${subCommand}`);
          console.log(
            `\nRun ${pc.cyan("wraps --help")} for available commands.\n`
          );
          process.exit(1);
      }
      // Track SMS commands
      const smsDuration = Date.now() - startTime;
      const smsCommandName = `sms:${subCommand}`;
      trackCommand(smsCommandName, {
        success: true,
        duration_ms: smsDuration,
        service: "sms",
      });
      return;
    }

    // Handle CDN subcommands (e.g., wraps cdn init)
    if (primaryCommand === "cdn" && subCommand) {
      switch (subCommand) {
        case "init":
          await cdnInit({
            provider: flags.provider,
            region: flags.region,
            preset: flags.preset,
            domain: flags.domain,
            yes: flags.yes,
            preview: flags.preview,
          });
          break;

        case "status":
          await cdnStatus({
            region: flags.region,
          });
          break;

        case "verify":
          await cdnVerify({
            region: flags.region,
          });
          break;

        case "upgrade":
          await cdnUpgrade({
            region: flags.region,
            yes: flags.yes,
            preview: flags.preview,
          });
          break;

        case "sync":
          await cdnSync({
            region: flags.region,
          });
          break;

        case "destroy":
          await cdnDestroy({
            force: flags.force,
            region: flags.region,
            preview: flags.preview,
          });
          break;

        default:
          clack.log.error(`Unknown cdn command: ${subCommand}`);
          console.log(
            `\nRun ${pc.cyan("wraps --help")} for available commands.\n`
          );
          process.exit(1);
      }
      // Track CDN commands
      const cdnDuration = Date.now() - startTime;
      const cdnCommandName = `cdn:${subCommand}`;
      trackCommand(cdnCommandName, {
        success: true,
        duration_ms: cdnDuration,
        service: "cdn",
      });
      return;
    }

    // Handle Platform subcommands
    if (primaryCommand === "platform") {
      if (!subCommand) {
        // Show platform info when no subcommand
        await platformInfo();
        const platformDuration = Date.now() - startTime;
        trackCommand("platform", {
          success: true,
          duration_ms: platformDuration,
        });
        return;
      }

      switch (subCommand) {
        case "update-role":
          await updateRole({
            region: flags.region,
            force: flags.force,
          });
          break;

        default:
          clack.log.error(`Unknown platform command: ${subCommand}`);
          console.log(`\nAvailable commands: ${pc.cyan("update-role")}\n`);
          console.log(
            `Run ${pc.cyan("wraps platform")} for more information.\n`
          );
          process.exit(1);
      }
      // Track platform commands (they return early, so track here)
      const platformDuration = Date.now() - startTime;
      const platformCommandName = `platform:${subCommand}`;
      trackCommand(platformCommandName, {
        success: true,
        duration_ms: platformDuration,
      });
      return;
    }

    // Handle AWS subcommands (e.g., wraps aws setup)
    if (primaryCommand === "aws" && subCommand) {
      switch (subCommand) {
        case "setup":
          await awsSetup({
            yes: flags.yes,
          });
          break;

        case "doctor":
          await awsDoctor();
          break;

        default:
          clack.log.error(`Unknown aws command: ${subCommand}`);
          console.log(
            `\nAvailable commands: ${pc.cyan("setup")}, ${pc.cyan("doctor")}\n`
          );
          console.log(`Run ${pc.cyan("wraps --help")} for more information.\n`);
          process.exit(1);
      }
      // Track aws commands
      const awsDuration = Date.now() - startTime;
      const awsCommandName = `aws:${subCommand}`;
      trackCommand(awsCommandName, {
        success: true,
        duration_ms: awsDuration,
      });
      return;
    }

    // Handle global commands
    switch (primaryCommand) {
      // Global commands (work across all services)
      case "status":
        await status({
          account: flags.account,
        });
        break;

      case "console":
        await dashboard({
          port: flags.port,
          noOpen: flags.noOpen,
        });
        break;

      case "destroy":
        await destroy({
          force: flags.force,
          preview: flags.preview,
        });
        break;

      case "completion":
        printCompletionScript();
        break;

      case "news":
        await news();
        break;

      case "permissions":
        await permissions({
          json: flags.json,
          preset: flags.preset as
            | "starter"
            | "production"
            | "enterprise"
            | undefined,
          service: flags.service as "email" | "sms" | "cdn" | undefined,
        });
        break;

      case "support":
        await support();
        break;

      case "telemetry": {
        // Handle telemetry subcommands
        switch (subCommand) {
          case "enable":
            await telemetryEnable();
            break;

          case "disable":
            await telemetryDisable();
            break;

          case "status":
          case undefined:
            await telemetryStatus();
            break;

          default:
            clack.log.error(`Unknown telemetry command: ${subCommand}`);
            console.log(
              `\nAvailable commands: ${pc.cyan("enable")}, ${pc.cyan("disable")}, ${pc.cyan("status")}\n`
            );
            process.exit(1);
        }
        break;
      }

      // Show help for service without subcommand
      case "email":
      case "sms":
      case "cdn":
      case "aws":
        console.log(
          `\nPlease specify a command for ${primaryCommand} service.\n`
        );
        showHelp();
        break;

      default:
        clack.log.error(`Unknown command: ${primaryCommand}`);
        console.log(
          `\nRun ${pc.cyan("wraps --help")} for available commands.\n`
        );
        process.exit(1);
    }
    // Track successful command execution
    const duration = Date.now() - startTime;
    const commandName = subCommand
      ? `${primaryCommand}:${subCommand}`
      : primaryCommand;

    trackCommand(commandName, {
      success: true,
      duration_ms: duration,
    });
  } catch (error) {
    // Track failed command execution
    const duration = Date.now() - startTime;
    const commandName = subCommand
      ? `${primaryCommand}:${subCommand}`
      : primaryCommand;

    trackCommand(commandName, {
      success: false,
      duration_ms: duration,
    });

    handleCLIError(error);
  } finally {
    // Ensure telemetry events are sent before exit
    await telemetry.shutdown();
  }
}

// Only run main command router if a command was provided
// (interactive menu handles its own flow when no command)
if (primaryCommand) {
  run();
}
