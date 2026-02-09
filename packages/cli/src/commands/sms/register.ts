import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

type SMSRegisterOptions = {
  region?: string;
};

/**
 * Get phone number details from AWS
 */
async function getPhoneNumberDetails(region: string): Promise<{
  phoneNumber: string;
  phoneNumberArn: string;
  status: string;
  type: string;
  registrationId?: string;
} | null> {
  const { PinpointSMSVoiceV2Client, DescribePhoneNumbersCommand } =
    await import("@aws-sdk/client-pinpoint-sms-voice-v2");

  const client = new PinpointSMSVoiceV2Client({ region });

  try {
    const response = await client.send(new DescribePhoneNumbersCommand({}));

    // Find wraps-managed phone number
    for (const phone of response.PhoneNumbers || []) {
      if (phone.OptOutListName === "wraps-sms-optouts") {
        return {
          phoneNumber: phone.PhoneNumber || "",
          phoneNumberArn: phone.PhoneNumberArn || "",
          status: phone.Status || "UNKNOWN",
          type: phone.NumberType || "UNKNOWN",
          registrationId: phone.RegistrationId,
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching phone number:", error);
    return null;
  }
}

/**
 * Get registration status if available
 */
async function getRegistrationStatus(
  region: string,
  registrationId: string
): Promise<string | null> {
  const { PinpointSMSVoiceV2Client, DescribeRegistrationsCommand } =
    await import("@aws-sdk/client-pinpoint-sms-voice-v2");

  const client = new PinpointSMSVoiceV2Client({ region });

  try {
    const response = await client.send(
      new DescribeRegistrationsCommand({
        RegistrationIds: [registrationId],
      })
    );

    return response.Registrations?.[0]?.RegistrationStatus || null;
  } catch {
    return null;
  }
}

/**
 * SMS Register command - Help register toll-free numbers
 */
export async function smsRegister(options: SMSRegisterOptions): Promise<void> {
  const startTime = Date.now();
  clack.intro(pc.bold("Wraps SMS - Toll-Free Registration"));

  const progress = new DeploymentProgress();

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  let region = options.region;
  if (!region) {
    region = await getAWSRegion();
  }

  // 3. Load metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.sms) {
    clack.log.error("No SMS infrastructure found.");
    clack.log.info(`Run ${pc.cyan("wraps sms init")} first.`);
    process.exit(1);
  }

  // 4. Get phone number details
  const phoneDetails = await progress.execute(
    "Checking phone number status",
    async () => getPhoneNumberDetails(region!)
  );

  if (!phoneDetails) {
    clack.log.error("No phone number found.");
    process.exit(1);
  }

  console.log("");
  console.log(
    `${pc.bold("Phone Number:")} ${pc.cyan(phoneDetails.phoneNumber)}`
  );
  console.log(`${pc.bold("Type:")} ${pc.cyan(phoneDetails.type)}`);
  console.log(
    `${pc.bold("Status:")} ${phoneDetails.status === "ACTIVE" ? pc.green(phoneDetails.status) : pc.yellow(phoneDetails.status)}`
  );

  // 5. Check registration status if available
  if (phoneDetails.registrationId) {
    const regStatus = await getRegistrationStatus(
      region,
      phoneDetails.registrationId
    );
    if (regStatus) {
      console.log(`${pc.bold("Registration:")} ${pc.cyan(regStatus)}`);
    }
  }

  console.log("");

  // 6. Handle based on status
  if (phoneDetails.status === "ACTIVE") {
    clack.log.success("Your phone number is already ACTIVE and ready to use!");

    // Check if pool exists
    const { PinpointSMSVoiceV2Client, DescribePoolsCommand } = await import(
      "@aws-sdk/client-pinpoint-sms-voice-v2"
    );
    const client = new PinpointSMSVoiceV2Client({ region });
    const pools = await client.send(new DescribePoolsCommand({}));

    if (!pools.Pools?.length) {
      clack.log.info("Run `wraps sms sync` to create the phone pool.");
    }

    process.exit(0);
  }

  if (phoneDetails.type !== "TOLL_FREE") {
    clack.log.info("Only toll-free numbers require registration.");
    clack.log.info(`Your ${phoneDetails.type} number should be ready to use.`);
    process.exit(0);
  }

  // 7. Show registration instructions
  console.log(pc.bold("Toll-Free Registration Required"));
  console.log("");
  console.log(
    pc.dim("To send SMS at scale, you must register your toll-free number.")
  );
  console.log(pc.dim("This process typically takes 1-15 business days."));
  console.log("");

  console.log(pc.bold("You'll need to provide:"));
  console.log(`  ${pc.dim("•")} Business name and address`);
  console.log(
    `  ${pc.dim("•")} Use case description (what messages you're sending)`
  );
  console.log(`  ${pc.dim("•")} Sample messages (2-3 examples)`);
  console.log(`  ${pc.dim("•")} How users opt-in to receive messages`);
  console.log(`  ${pc.dim("•")} Expected monthly message volume`);
  console.log("");

  // 8. Offer to open AWS console
  const openConsole = await clack.confirm({
    message: "Open AWS Console to start registration?",
    initialValue: true,
  });

  if (clack.isCancel(openConsole)) {
    clack.cancel("Registration cancelled.");
    process.exit(0);
  }

  if (openConsole) {
    const consoleUrl = `https://${region}.console.aws.amazon.com/sms-voice/home?region=${region}#/registrations`;

    // Open browser
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    try {
      // macOS
      await execAsync(`open "${consoleUrl}"`);
      clack.log.success("Opened AWS Console in your browser.");
    } catch {
      try {
        // Linux
        await execAsync(`xdg-open "${consoleUrl}"`);
        clack.log.success("Opened AWS Console in your browser.");
      } catch {
        // Fallback - just show the URL
        clack.log.info("Open this URL in your browser:");
        console.log(`\n  ${pc.cyan(consoleUrl)}\n`);
      }
    }

    console.log("");
    console.log(pc.bold("Next Steps:"));
    console.log(
      `  1. Click ${pc.cyan("Create registration")} in the AWS Console`
    );
    console.log(`  2. Select ${pc.cyan("Toll-free number registration")}`);
    console.log("  3. Fill out the business information form");
    console.log("  4. Submit and wait for approval (1-15 business days)");
    console.log("");
    console.log(
      pc.dim("Once approved, run `wraps sms sync` to complete setup.")
    );
  } else {
    const consoleUrl = `https://${region}.console.aws.amazon.com/sms-voice/home?region=${region}#/registrations`;
    console.log("");
    console.log("When you're ready, go to:");
    console.log(`  ${pc.cyan(consoleUrl)}`);
  }

  trackCommand("sms:register", {
    success: true,
    duration_ms: Date.now() - startTime,
  });

  clack.outro(pc.dim("Good luck with your registration!"));
}
