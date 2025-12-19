import {
  CreateVerifiedDestinationNumberCommand,
  DeleteVerifiedDestinationNumberCommand,
  DescribeVerifiedDestinationNumbersCommand,
  PinpointSMSVoiceV2Client,
  SendDestinationNumberVerificationCodeCommand,
  VerifyDestinationNumberCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand, trackError } from "../../telemetry/events.js";
import type { SMSVerifyNumberOptions } from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Validate phone number format (E.164)
 */
function isValidPhoneNumber(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * SMS Verify Number command - Verify a destination phone number for sandbox testing
 */
export async function smsVerifyNumber(
  options: SMSVerifyNumberOptions
): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps SMS - Verify Destination Number"));

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

  const client = new PinpointSMSVoiceV2Client({ region });

  // Handle --list flag
  if (options.list) {
    try {
      const response = await progress.execute(
        "Fetching verified numbers",
        async () =>
          client.send(new DescribeVerifiedDestinationNumbersCommand({}))
      );

      progress.stop();

      if (
        !response.VerifiedDestinationNumbers ||
        response.VerifiedDestinationNumbers.length === 0
      ) {
        clack.log.info("No verified destination numbers found");
        console.log(
          `\nRun ${pc.cyan("wraps sms verify-number")} to verify a number.\n`
        );
      } else {
        console.log("\n");
        clack.log.info(pc.bold("Verified Destination Numbers:"));
        console.log("");
        for (const num of response.VerifiedDestinationNumbers) {
          const status =
            num.Status === "VERIFIED"
              ? pc.green("✓ Verified")
              : pc.yellow("⧖ Pending");
          console.log(`  ${pc.cyan(num.DestinationPhoneNumber)} - ${status}`);
        }
        console.log("");
      }

      trackCommand("sms:verify-number:list", {
        success: true,
        count: response.VerifiedDestinationNumbers?.length || 0,
        duration_ms: Date.now() - startTime,
      });

      clack.outro(pc.green("Done!"));
      return;
    } catch (error: unknown) {
      progress.stop();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      trackError("SMS_LIST_VERIFIED_FAILED", "sms:verify-number:list", {
        error: errorMessage,
      });
      clack.log.error(`Failed to list verified numbers: ${errorMessage}`);
      process.exit(1);
    }
  }

  // Handle --delete flag
  if (options.delete) {
    const phoneNumber = options.phoneNumber;
    if (!phoneNumber) {
      progress.stop();
      clack.log.error("Phone number is required for deletion");
      console.log(
        `\nUsage: ${pc.cyan("wraps sms verify-number --delete --phone-number +14155551234")}\n`
      );
      process.exit(1);
    }

    try {
      // First find the verified destination number ID
      const listResponse = await client.send(
        new DescribeVerifiedDestinationNumbersCommand({
          DestinationPhoneNumbers: [phoneNumber],
        })
      );

      const verifiedNumber = listResponse.VerifiedDestinationNumbers?.[0];
      if (!verifiedNumber?.VerifiedDestinationNumberId) {
        progress.stop();
        clack.log.error(`Number ${phoneNumber} is not in verified list`);
        process.exit(1);
      }

      await progress.execute(`Removing ${phoneNumber}`, async () => {
        await client.send(
          new DeleteVerifiedDestinationNumberCommand({
            VerifiedDestinationNumberId:
              verifiedNumber.VerifiedDestinationNumberId,
          })
        );
      });

      progress.stop();
      clack.log.success(`Removed ${pc.cyan(phoneNumber)} from verified list`);

      trackCommand("sms:verify-number:delete", {
        success: true,
        duration_ms: Date.now() - startTime,
      });

      clack.outro(pc.green("Done!"));
      return;
    } catch (error: unknown) {
      progress.stop();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      trackError("SMS_DELETE_VERIFIED_FAILED", "sms:verify-number:delete", {
        error: errorMessage,
      });
      clack.log.error(`Failed to delete verified number: ${errorMessage}`);
      process.exit(1);
    }
  }

  // Main flow: verify a new number
  let phoneNumber = options.phoneNumber;
  if (!phoneNumber) {
    const result = await clack.text({
      message: "Enter phone number to verify (E.164 format):",
      placeholder: "+14155551234",
      validate: (value) => {
        if (!value) return "Phone number is required";
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

    phoneNumber = result;
  } else if (!isValidPhoneNumber(phoneNumber)) {
    progress.stop();
    clack.log.error(
      `Invalid phone number format: ${phoneNumber}. Use E.164 format (e.g., +14155551234)`
    );
    process.exit(1);
  }

  // Handle --code flag (completing verification)
  if (options.code) {
    try {
      // First find the verified destination number ID
      const listResponse = await client.send(
        new DescribeVerifiedDestinationNumbersCommand({
          DestinationPhoneNumbers: [phoneNumber],
        })
      );

      const verifiedNumber = listResponse.VerifiedDestinationNumbers?.[0];
      if (!verifiedNumber?.VerifiedDestinationNumberId) {
        progress.stop();
        clack.log.error(
          `Number ${phoneNumber} not found. Run without --code first.`
        );
        process.exit(1);
      }

      await progress.execute("Verifying code", async () => {
        await client.send(
          new VerifyDestinationNumberCommand({
            VerifiedDestinationNumberId:
              verifiedNumber.VerifiedDestinationNumberId,
            VerificationCode: options.code,
          })
        );
      });

      progress.stop();

      console.log("\n");
      clack.log.success(
        pc.green(`Phone number ${pc.cyan(phoneNumber)} verified!`)
      );
      console.log("");
      console.log(
        `You can now send test messages to this number with ${pc.cyan("wraps sms test")}`
      );

      trackCommand("sms:verify-number:confirm", {
        success: true,
        duration_ms: Date.now() - startTime,
      });

      clack.outro(pc.green("Verification complete!"));
      return;
    } catch (error: unknown) {
      progress.stop();
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("Invalid verification code")) {
        clack.log.error("Invalid verification code. Please try again.");
        console.log(
          `\nRun ${pc.cyan(`wraps sms verify-number --phone-number ${phoneNumber} --resend`)} to get a new code.\n`
        );
      } else {
        trackError("SMS_VERIFY_CODE_FAILED", "sms:verify-number:confirm", {
          error: errorMessage,
        });
        clack.log.error(`Verification failed: ${errorMessage}`);
      }
      process.exit(1);
    }
  }

  // Handle --resend flag
  if (options.resend) {
    try {
      // Find the verified destination number ID
      const listResponse = await client.send(
        new DescribeVerifiedDestinationNumbersCommand({
          DestinationPhoneNumbers: [phoneNumber],
        })
      );

      const verifiedNumber = listResponse.VerifiedDestinationNumbers?.[0];
      if (!verifiedNumber?.VerifiedDestinationNumberId) {
        progress.stop();
        clack.log.error(
          `Number ${phoneNumber} not found. Run without --resend first.`
        );
        process.exit(1);
      }

      await progress.execute(`Resending code to ${phoneNumber}`, async () => {
        await client.send(
          new SendDestinationNumberVerificationCodeCommand({
            VerifiedDestinationNumberId:
              verifiedNumber.VerifiedDestinationNumberId,
            VerificationChannel: "TEXT",
          })
        );
      });

      progress.stop();

      clack.log.success(`Verification code resent to ${pc.cyan(phoneNumber)}`);
      console.log("");
      console.log(
        `Once you receive the code, run:\n  ${pc.cyan(`wraps sms verify-number --phone-number ${phoneNumber} --code YOUR_CODE`)}`
      );

      trackCommand("sms:verify-number:resend", {
        success: true,
        duration_ms: Date.now() - startTime,
      });

      clack.outro(pc.green("Code sent!"));
      return;
    } catch (error: unknown) {
      progress.stop();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      trackError("SMS_RESEND_CODE_FAILED", "sms:verify-number:resend", {
        error: errorMessage,
      });
      clack.log.error(`Failed to resend code: ${errorMessage}`);
      process.exit(1);
    }
  }

  // Start new verification
  try {
    // Check if already verified
    const listResponse = await client.send(
      new DescribeVerifiedDestinationNumbersCommand({
        DestinationPhoneNumbers: [phoneNumber],
      })
    );

    const existingNumber = listResponse.VerifiedDestinationNumbers?.[0];
    if (existingNumber?.Status === "VERIFIED") {
      progress.stop();
      clack.log.info(
        `Number ${pc.cyan(phoneNumber)} is already verified and ready to use!`
      );
      clack.outro(pc.green("Done!"));
      return;
    }

    // If pending, just resend the code
    if (existingNumber?.Status === "PENDING") {
      await progress.execute(
        `Resending verification code to ${phoneNumber}`,
        async () => {
          await client.send(
            new SendDestinationNumberVerificationCodeCommand({
              VerifiedDestinationNumberId:
                existingNumber.VerifiedDestinationNumberId,
              VerificationChannel: "TEXT",
            })
          );
        }
      );

      progress.stop();

      clack.log.info(
        `Verification already in progress. New code sent to ${pc.cyan(phoneNumber)}`
      );
      console.log("");
      console.log(
        `Once you receive the code, run:\n  ${pc.cyan(`wraps sms verify-number --phone-number ${phoneNumber} --code YOUR_CODE`)}`
      );

      clack.outro(pc.green("Code sent!"));
      return;
    }

    // Create new verified destination number
    const createResponse = await progress.execute(
      `Creating verification for ${phoneNumber}`,
      async () =>
        client.send(
          new CreateVerifiedDestinationNumberCommand({
            DestinationPhoneNumber: phoneNumber,
          })
        )
    );

    // Send verification code
    await progress.execute("Sending verification code", async () => {
      await client.send(
        new SendDestinationNumberVerificationCodeCommand({
          VerifiedDestinationNumberId:
            createResponse.VerifiedDestinationNumberId,
          VerificationChannel: "TEXT",
        })
      );
    });

    progress.stop();

    console.log("\n");
    clack.log.success(
      `Verification code sent to ${pc.cyan(phoneNumber)} via SMS`
    );
    console.log("");

    clack.note(
      [
        "1. Check your phone for the verification code",
        "",
        "2. Complete verification with:",
        `   ${pc.cyan(`wraps sms verify-number --phone-number ${phoneNumber} --code YOUR_CODE`)}`,
        "",
        pc.dim("The code expires in 24 hours"),
      ].join("\n"),
      "Next Steps"
    );

    trackCommand("sms:verify-number:start", {
      success: true,
      duration_ms: Date.now() - startTime,
    });

    clack.outro(pc.green("Verification started!"));
  } catch (error: unknown) {
    progress.stop();
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("already exists")) {
      clack.log.error("This number is already being verified");
      console.log(
        `\nRun ${pc.cyan(`wraps sms verify-number --phone-number ${phoneNumber} --resend`)} to get a new code.\n`
      );
    } else {
      trackError("SMS_CREATE_VERIFIED_FAILED", "sms:verify-number:start", {
        error: errorMessage,
      });
      clack.log.error(`Failed to start verification: ${errorMessage}`);
    }
    process.exit(1);
  }
}
