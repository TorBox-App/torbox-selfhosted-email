import * as clack from "@clack/prompts";
import open from "open";
import pc from "picocolors";
import { trackCommand, trackError } from "../../telemetry/events.js";
import {
  createCliAuthClient,
  fetchOrganizations,
} from "../../utils/shared/auth-client.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import { saveAuthConfig } from "../../utils/shared/config.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { resolveRegionForCommand } from "../../utils/shared/region-resolver.js";

type SelfhostLoginOptions = {
  region?: string;
  json?: boolean;
};

export async function selfhostLogin(
  options: SelfhostLoginOptions
): Promise<void> {
  const startTime = Date.now();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Self-Hosted › Sign In"));
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

  clack.log.info(`Connecting to: ${pc.cyan(baseURL)}`);

  const authClient = createCliAuthClient(baseURL);
  const spinner = clack.spinner();

  // 3. Request device code
  const { data: codeData, error: codeError } = await authClient.device.code({
    client_id: "wraps-cli",
  });

  if (codeError || !codeData) {
    trackCommand("selfhost:login", {
      success: false,
      duration_ms: Date.now() - startTime,
      method: "device",
    });
    trackError("DEVICE_AUTH_FAILED", "selfhost:login", {
      step: "request_code",
    });
    clack.log.error(
      `Failed to reach ${pc.cyan(baseURL)}. Make sure the dashboard is deployed and reachable.`
    );
    throw new Error("Failed to start device authorization.");
  }

  const { device_code, user_code, interval, expires_in } = codeData;

  const formatted = `${user_code.slice(0, 4)}-${user_code.slice(4)}`;
  clack.log.info(`Your code:  ${pc.bold(pc.cyan(formatted))}`);
  clack.log.info(`Visit: ${pc.underline(`${baseURL}/device`)}`);

  try {
    await open(`${baseURL}/device?user_code=${user_code}`);
    clack.log.info("Opening browser...");
    // baseline:allow-next-line no-swallowed-errors — browser open is best-effort
  } catch {
    // User will navigate manually
  }

  spinner.start("Waiting for approval...");

  // 4. Poll for token
  const pollInterval = (interval || 3) * 1000;
  const expiresAt = Date.now() + (expires_in || 900) * 1000;

  while (Date.now() < expiresAt) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const { data: tokenData, error: tokenError } =
      await authClient.device.token({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code,
        client_id: "wraps-cli",
      });

    if (tokenData?.access_token) {
      spinner.stop("Approved!");

      const organizations = await fetchOrganizations(
        baseURL,
        tokenData.access_token
      );

      await saveAuthConfig({
        auth: {
          token: tokenData.access_token,
          tokenType: "session",
          expiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : undefined,
          organizations: organizations.length > 0 ? organizations : undefined,
        },
      });

      trackCommand("selfhost:login", {
        success: true,
        duration_ms: Date.now() - startTime,
        method: "device",
      });

      clack.log.success("Signed in to your self-hosted Wraps instance.");

      if (organizations.length === 1) {
        clack.log.info(`Organization: ${pc.cyan(organizations[0].name)}`);
      } else if (organizations.length > 1) {
        clack.log.info(`${organizations.length} organizations available`);
      } else {
        clack.log.info(
          `No organizations found. Create one at ${pc.underline(`${baseURL}/onboarding`)} and run ${pc.cyan("wraps selfhost login")} again.`
        );
      }

      if (isJsonMode()) {
        jsonSuccess("selfhost.login", { tokenType: "session", organizations });
      } else {
        clack.outro(pc.green("Done!"));
      }

      return;
    }

    if (tokenError) {
      const err = tokenError as { error?: string; code?: string };
      const errorCode = err.error || err.code;

      if (errorCode === "authorization_pending") continue;
      if (errorCode === "slow_down") {
        await new Promise((r) => setTimeout(r, pollInterval));
        continue;
      }

      if (errorCode === "access_denied") {
        trackCommand("selfhost:login", {
          success: false,
          duration_ms: Date.now() - startTime,
          method: "device",
        });
        trackError("ACCESS_DENIED", "selfhost:login", { step: "poll_token" });
        spinner.stop("Denied.");
        clack.log.error("Authorization was denied.");
        throw new Error("Authorization was denied.");
      }

      if (errorCode === "expired_token") break;
    }
  }

  trackCommand("selfhost:login", {
    success: false,
    duration_ms: Date.now() - startTime,
    method: "device",
  });
  trackError("DEVICE_CODE_EXPIRED", "selfhost:login", { step: "poll_token" });
  spinner.stop("Expired.");
  clack.log.error(
    "Device code expired. Run `wraps selfhost login` to try again."
  );
  throw new Error("Device code expired.");
}
