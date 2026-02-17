import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand, trackError } from "../../telemetry/events.js";
import type { SMSTestOptions } from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { WrapsError } from "../../utils/shared/errors.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import { isValidPhoneNumber } from "../../utils/sms/validation.js";

/**
 * AWS SMS Simulator destination numbers for testing
 * These work in sandbox mode without needing to verify a real number
 */
const SIMULATOR_DESTINATIONS = [
  { number: "+14254147755", country: "United States (US)" },
  { number: "+447860019066", country: "United Kingdom (GB)" },
  { number: "+61455944038", country: "Australia (AU)" },
  { number: "+33755512501", country: "France (FR)" },
  { number: "+4525919410", country: "Denmark (DK)" },
  { number: "+34683783440", country: "Spain (ES)" },
  { number: "+46790645100", country: "Sweden (SE)" },
  { number: "+31970008100148", country: "Netherlands (NL)" },
] as const;

/**
 * SMS Test command - Send a test SMS message
 */
export async function smsTest(options: SMSTestOptions): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps SMS Test"));
  }

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  const region = await getAWSRegion();

  // 3. Check for existing metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.sms) {
    progress.stop();
    clack.log.error("No SMS infrastructure found");
    console.log(
      `\nRun ${pc.cyan("wraps sms init")} to deploy SMS infrastructure.\n`
    );
    process.exit(1);
  }

  // 4. Get phone number to send to
  let toNumber = options.to;
  if (!toNumber && isJsonMode()) {
    throw new WrapsError(
      "The --to flag is required in JSON mode",
      "MISSING_REQUIRED_FLAG",
      "Provide --to <phone-number>"
    );
  }
  if (!toNumber) {
    // First ask if they want to use a simulator number or enter their own
    const destinationType = await clack.select({
      message: "Choose destination number:",
      options: [
        {
          value: "simulator",
          label: "Use simulator number",
          hint: "Pre-verified AWS numbers for testing (sandbox mode)",
        },
        {
          value: "custom",
          label: "Enter custom number",
          hint: "Must be verified in sandbox mode",
        },
      ],
    });

    if (clack.isCancel(destinationType)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }

    if (destinationType === "simulator") {
      // Show simulator number options
      const simResult = await clack.select({
        message: "Select simulator destination:",
        options: SIMULATOR_DESTINATIONS.map((sim) => ({
          value: sim.number,
          label: `${sim.number} | ${sim.country}`,
        })),
      });

      if (clack.isCancel(simResult)) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }

      toNumber = simResult as string;
    } else {
      // Custom number entry
      const result = await clack.text({
        message: "Enter destination phone number (E.164 format):",
        placeholder: "+14155551234",
        validate: (value) => {
          if (!value) {
            return "Phone number is required";
          }
          if (!isValidPhoneNumber(value)) {
            return "Please enter a valid phone number in E.164 format (e.g., +14155551234)";
          }
          return;
        },
      });

      if (clack.isCancel(result)) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }

      toNumber = result;
    }
  } else if (!isValidPhoneNumber(toNumber)) {
    progress.stop();
    clack.log.error(
      `Invalid phone number format: ${toNumber}. Use E.164 format (e.g., +14155551234)`
    );
    process.exit(1);
  }

  // 5. Get message
  let message = options.message;
  if (!message) {
    const result = await clack.text({
      message: "Enter test message:",
      placeholder: "Hello from Wraps SMS!",
      defaultValue: "Hello from Wraps SMS! This is a test message.",
      validate: (value) => {
        if (!value) {
          return "Message is required";
        }
        if (value.length > 160) {
          return `Message is ${value.length} characters. SMS messages over 160 characters will be split.`;
        }
        return;
      },
    });

    if (clack.isCancel(result)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }

    message = result;
  }

  // 6. Send test message
  const smsConfig = metadata.services.sms.config;
  const configSetName = "wraps-sms-config";

  try {
    const messageId = await progress.execute(
      `Sending test SMS to ${toNumber}`,
      async () => {
        const client = new PinpointSMSVoiceV2Client({ region });

        const command = new SendTextMessageCommand({
          DestinationPhoneNumber: toNumber,
          MessageBody: message,
          ConfigurationSetName: configSetName,
          MessageType: "TRANSACTIONAL",
        });

        const response = await client.send(command);
        return response.MessageId;
      }
    );

    progress.stop();

    // 7. Track success
    trackCommand("sms:test", {
      success: true,
      phone_type: smsConfig?.phoneNumberType,
      message_length: message?.length,
      duration_ms: Date.now() - startTime,
    });

    if (isJsonMode()) {
      jsonSuccess("sms.test", {
        messageId: messageId || "unknown",
        to: toNumber!,
        message: message!,
        phoneNumberType: smsConfig?.phoneNumberType || "simulator",
      });
      return;
    }

    // 8. Display success
    console.log("\n");
    clack.log.success(pc.green("Test SMS sent successfully!"));
    console.log("");

    clack.note(
      [
        `${pc.bold("Message ID:")} ${pc.cyan(messageId || "unknown")}`,
        `${pc.bold("To:")} ${pc.cyan(toNumber)}`,
        `${pc.bold("Message:")} ${message}`,
        `${pc.bold("Type:")} ${pc.cyan(smsConfig?.phoneNumberType || "simulator")}`,
        "",
        pc.dim(
          smsConfig?.phoneNumberType === "simulator"
            ? "Note: Simulator messages are not actually delivered"
            : "Check your phone for the message!"
        ),
      ].join("\n"),
      "SMS Sent"
    );

    // 9. Show next steps
    if (smsConfig?.eventTracking?.enabled) {
      console.log("");
      clack.log.info(
        pc.dim("Event tracking is enabled. Check DynamoDB for delivery status.")
      );
    }

    clack.outro(pc.green("Test complete!"));
  } catch (error: unknown) {
    progress.stop();

    const errorMessage = error instanceof Error ? error.message : String(error);

    trackError("SMS_SEND_FAILED", "sms:test", { error: errorMessage });
    trackCommand("sms:test", {
      success: false,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    // Handle specific error cases
    const errorName =
      error instanceof Error ? (error as { name: string }).name : "";

    if (errorName === "ConflictException" || errorMessage.includes("opt-out")) {
      clack.log.error("Destination number has opted out of messages");
      console.log("\nThe recipient has opted out of receiving SMS messages.\n");
    } else if (
      errorName === "ThrottlingException" ||
      errorMessage.includes("spending limit")
    ) {
      clack.log.error("SMS rate or spending limit reached");
      console.log(
        "\nCheck your AWS account SMS spending limits in the console.\n"
      );
    } else if (errorName === "ValidationException") {
      clack.log.error(`Invalid request: ${errorMessage}`);
    } else if (
      errorMessage.includes("not verified") ||
      errorMessage.includes("not registered")
    ) {
      clack.log.error("Toll-free number registration is not complete");
      console.log(
        `\nRun ${pc.cyan("wraps sms register")} to check registration status.\n`
      );
    } else if (errorName === "AccessDeniedException") {
      clack.log.error(
        "Permission denied — IAM role may be missing SMS send permissions"
      );
      console.log(
        `\nRun ${pc.cyan("wraps sms upgrade")} to update IAM policies.\n`
      );
    } else {
      clack.log.error(`Failed to send SMS: ${errorMessage}`);
    }

    process.exit(1);
  }
}
