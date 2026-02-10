import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand, trackError } from "../../telemetry/events.js";
import type { EmailTestOptions } from "../../types/index.js";
import {
  isSimulatorAddress,
  SES_SIMULATOR_ADDRESSES,
  SIMULATOR_SCENARIOS,
} from "../../utils/email/ses-simulator.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Email Test command - Send a test email via SES
 */
export async function emailTest(options: EmailTestOptions): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps Email Test"));

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  const region = options.region || (await getAWSRegion());

  // 3. Check for existing metadata (email must be deployed)
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.email) {
    progress.stop();
    clack.log.error("No email infrastructure found");
    console.log(
      `\nRun ${pc.cyan("wraps email init")} to deploy email infrastructure.\n`
    );
    process.exit(1);
    return;
  }

  const emailConfig = metadata.services.email;
  const domain = emailConfig.config.domain;

  if (!domain) {
    progress.stop();
    clack.log.error("No domain configured in email infrastructure");
    console.log(`\nRun ${pc.cyan("wraps email init")} to set up a domain.\n`);
    process.exit(1);
    return;
  }

  // 4. Get recipient email
  let toEmail = options.to;

  if (!toEmail) {
    // Check if a scenario was passed via flag
    if (options.scenario) {
      const scenarioKey =
        options.scenario.toUpperCase() as keyof typeof SES_SIMULATOR_ADDRESSES;
      toEmail = SES_SIMULATOR_ADDRESSES[scenarioKey];
      if (!toEmail) {
        progress.stop();
        clack.log.error(
          `Unknown scenario: ${options.scenario}. Valid: success, bounce, complaint, ooto, suppression_list`
        );
        process.exit(1);
        return;
      }
    } else {
      // Interactive prompt
      const destinationType = await clack.select({
        message: "Choose test destination:",
        options: [
          {
            value: "simulator",
            label: "Use SES simulator",
            hint: "Works in sandbox mode, doesn't affect reputation",
          },
          {
            value: "custom",
            label: "Enter email address",
            hint: "Must be verified if in sandbox mode",
          },
        ],
      });

      if (clack.isCancel(destinationType)) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }

      if (destinationType === "simulator") {
        const scenario = await clack.select({
          message: "Select test scenario:",
          options: Object.entries(SIMULATOR_SCENARIOS).map(([key, info]) => ({
            value: key,
            label: info.name,
            hint: info.description,
          })),
        });

        if (clack.isCancel(scenario)) {
          clack.cancel("Operation cancelled.");
          process.exit(0);
        }

        toEmail =
          SES_SIMULATOR_ADDRESSES[
            scenario as keyof typeof SES_SIMULATOR_ADDRESSES
          ];
      } else {
        const result = await clack.text({
          message: "Enter recipient email:",
          placeholder: "you@example.com",
          validate: (value) => {
            if (!value) {
              return "Email is required";
            }
            if (!value.includes("@")) {
              return "Please enter a valid email address";
            }
            return;
          },
        });

        if (clack.isCancel(result)) {
          clack.cancel("Operation cancelled.");
          process.exit(0);
        }

        toEmail = result;
      }
    }
  }

  // 5. Send test email
  const fromEmail = `test@${domain}`;

  try {
    const messageId = await progress.execute(
      `Sending test email to ${toEmail}`,
      async () => {
        const client = new SESv2Client({ region });

        const response = await client.send(
          new SendEmailCommand({
            FromEmailAddress: fromEmail,
            Destination: { ToAddresses: [toEmail!] },
            Content: {
              Simple: {
                Subject: {
                  Data: "Test email from Wraps",
                  Charset: "UTF-8",
                },
                Body: {
                  Html: {
                    Data: `<h1>It works!</h1><p>This test email was sent from <strong>${domain}</strong> via Wraps.</p><p>Your email infrastructure is working correctly.</p>`,
                    Charset: "UTF-8",
                  },
                  Text: {
                    Data: `It works! This test email was sent from ${domain} via Wraps. Your email infrastructure is working correctly.`,
                    Charset: "UTF-8",
                  },
                },
              },
            },
            ConfigurationSetName: "wraps-email-tracking",
          })
        );

        return response.MessageId;
      }
    );

    progress.stop();

    // 6. Display success
    const isSimulator = isSimulatorAddress(toEmail!);

    console.log("\n");
    clack.log.success(pc.green("Test email sent successfully!"));
    console.log("");

    clack.note(
      [
        `${pc.bold("Message ID:")} ${pc.cyan(messageId || "unknown")}`,
        `${pc.bold("From:")} ${pc.cyan(fromEmail)}`,
        `${pc.bold("To:")} ${pc.cyan(toEmail)}`,
        "",
        isSimulator
          ? pc.dim(
              "Simulator emails are accepted by AWS but not actually delivered."
            )
          : pc.dim(
              "Check the recipient's inbox (and spam folder) for the email."
            ),
      ].join("\n"),
      "Email Sent"
    );

    // 7. Track success
    trackCommand("email:test", {
      success: true,
      is_simulator: isSimulator,
      duration_ms: Date.now() - startTime,
    });

    clack.outro(pc.green("Test complete!"));
  } catch (error: unknown) {
    progress.stop();

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "";

    trackError("EMAIL_SEND_FAILED", "email:test", { error: errorMessage });
    trackCommand("email:test", {
      success: false,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    // Handle specific SES errors
    if (
      errorName === "MessageRejected" ||
      errorMessage.includes("MessageRejected")
    ) {
      if (errorMessage.includes("not verified")) {
        clack.log.error("Email address is not verified");
        console.log("\nIn sandbox mode, recipient addresses must be verified.");
        console.log(
          `Simulator addresses always work: ${pc.cyan("success@simulator.amazonses.com")}\n`
        );
      } else {
        clack.log.error(`Email rejected: ${errorMessage}`);
      }
    } else if (errorName === "MailFromDomainNotVerifiedException") {
      clack.log.error("Sending domain is not verified");
      console.log(
        `\nRun ${pc.cyan(`wraps email verify --domain ${domain}`)} to check DNS status.\n`
      );
    } else if (
      errorName === "SendingPausedException" ||
      errorName === "AccountSuspendedException"
    ) {
      clack.log.error("Email sending is disabled on this account");
      console.log("\nCheck the AWS SES console for account status.\n");
    } else if (errorName === "NotFoundException") {
      clack.log.error(
        "Configuration set not found. Your infrastructure may need to be redeployed."
      );
      console.log(
        `\nRun ${pc.cyan("wraps email status")} to check your setup.\n`
      );
    } else {
      clack.log.error(`Failed to send email: ${errorMessage}`);
    }

    process.exit(1);
  }
}
