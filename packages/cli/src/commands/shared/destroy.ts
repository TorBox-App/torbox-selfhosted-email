import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import type { DestroyOptions } from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import { WrapsError } from "../../utils/shared/errors.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { emailDestroy } from "../email/destroy.js";

/**
 * Global Destroy command - Show services and route to service-specific destroy
 */
export async function destroy(options: DestroyOptions): Promise<void> {
  trackCommand("destroy", { success: true });

  // JSON mode requires --force for destructive operations
  if (isJsonMode() && !options.force) {
    throw new WrapsError(
      "--force flag is required in JSON mode for destructive operations",
      "JSON_REQUIRES_FORCE",
      "Add --force flag: wraps destroy --json --force"
    );
  }

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Infrastructure Teardown"));
  }

  // 1. Validate AWS credentials
  const spinner = clack.spinner();
  spinner.start("Validating AWS credentials");

  let identity;
  try {
    identity = await validateAWSCredentials();
    spinner.stop("AWS credentials validated");
  } catch (error) {
    spinner.stop("AWS credentials validation failed");
    throw error;
  }

  // 2. Get region
  const region = await getAWSRegion();

  // 3. Load connection metadata to see what services are deployed
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  const deployedServices: string[] = [];

  if (metadata?.services?.email) {
    deployedServices.push("email");
  }

  if (deployedServices.length === 0) {
    clack.log.warn("No Wraps services found in this region");
    console.log(
      `\nRun ${pc.cyan("wraps email init")} to deploy infrastructure.\n`
    );
    process.exit(0);
  }

  // 4. If only one service, destroy it directly
  if (deployedServices.length === 1) {
    const service = deployedServices[0];
    clack.log.info(`Found ${pc.cyan(service)} service deployed`);

    if (service === "email") {
      // Pass through to email destroy
      await emailDestroy(options);
      return;
    }
  }

  // 5. Multiple services - ask which to destroy
  if (isJsonMode()) {
    // In JSON mode, destroy all services
    for (const service of deployedServices) {
      if (service === "email") {
        await emailDestroy(options);
      }
    }
    jsonSuccess("destroy", { destroyed: true });
    return;
  }

  const serviceToDestroy = await clack.select({
    message: "Which service would you like to destroy?",
    options: [
      ...deployedServices.map((s) => ({
        value: s,
        label: s.charAt(0).toUpperCase() + s.slice(1),
        hint: s === "email" ? "AWS SES email infrastructure" : undefined,
      })),
      {
        value: "all",
        label: "All services",
        hint: "Destroy all Wraps infrastructure",
      },
    ],
  });

  if (clack.isCancel(serviceToDestroy)) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }

  // 6. Route to appropriate destroy command
  if (
    (serviceToDestroy === "email" || serviceToDestroy === "all") &&
    deployedServices.includes("email")
  ) {
    await emailDestroy(options);
  }

  if (serviceToDestroy === "all") {
    clack.outro(pc.green("All Wraps infrastructure has been removed"));
  }
}
