import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import {
  clearSelfhostAuth,
  readSelfhostAuth,
} from "../../utils/shared/config.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { resolveRegionForCommand } from "../../utils/shared/region-resolver.js";

type SelfhostLogoutOptions = {
  region?: string;
  json?: boolean;
};

/**
 * selfhost logout — clear the stored session for a self-hosted instance,
 * leaving the SaaS session and other instances untouched.
 */
export async function selfhostLogout(
  options: SelfhostLogoutOptions
): Promise<void> {
  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Self-Hosted › Sign Out"));
  }

  // 1. Validate AWS credentials (needed to locate the right metadata file)
  const identity = await validateAWSCredentials();

  // 2. Resolve region and load selfhost metadata
  const region = await resolveRegionForCommand({
    accountId: identity.accountId,
    optionRegion: options.region,
    service: "selfhost",
    label: "self-hosted deployment",
  });

  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.selfhost) {
    clack.log.error("No self-hosted deployment found.");
    console.log(
      `\nRun ${pc.cyan("wraps selfhost deploy")} to deploy the self-hosted control plane first.\n`
    );
    process.exit(1);
    return;
  }

  const { appUrl: baseURL } = metadata.services.selfhost.config;

  if (!(await readSelfhostAuth(baseURL))) {
    trackCommand("selfhost:logout", {
      success: true,
      already_logged_out: true,
    });
    if (isJsonMode()) {
      jsonSuccess("selfhost.logout", {
        loggedOut: false,
        alreadyLoggedOut: true,
      });
      return;
    }
    clack.log.info(`Not signed in to ${pc.cyan(baseURL)}.`);
    return;
  }

  await clearSelfhostAuth(baseURL);
  trackCommand("selfhost:logout", { success: true });

  if (isJsonMode()) {
    jsonSuccess("selfhost.logout", { loggedOut: true });
    return;
  }

  clack.log.success(`Signed out of ${pc.cyan(baseURL)}.`);
}
