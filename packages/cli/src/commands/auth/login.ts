import * as clack from "@clack/prompts";
import { createAuthClient } from "better-auth/client";
import {
  deviceAuthorizationClient,
  organizationClient,
} from "better-auth/client/plugins";
import open from "open";
import pc from "picocolors";
import { type OrgInfo, saveAuthConfig } from "../../utils/shared/config.js";

type LoginOptions = {
  token?: string;
  json?: boolean;
};

function createCliAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [deviceAuthorizationClient(), organizationClient()],
  });
}

async function fetchOrganizations(
  baseURL: string,
  token: string
): Promise<OrgInfo[]> {
  try {
    const client = createCliAuthClient(baseURL);
    const { data } = await client.organization.list({
      fetchOptions: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    if (!data) return [];
    return data.map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
    }));
  } catch {
    return [];
  }
}

export async function login(options: LoginOptions): Promise<void> {
  // API key direct login
  if (options.token) {
    await saveAuthConfig({
      auth: {
        token: options.token,
        tokenType: "api-key",
      },
    });

    if (options.json) {
      console.log(JSON.stringify({ success: true, tokenType: "api-key" }));
    } else {
      clack.log.success("API key saved.");
    }
    return;
  }

  // Device flow
  clack.intro(pc.bold("Wraps \u203A Sign In"));

  const baseURL = process.env.WRAPS_API_URL || "https://app.wraps.dev";
  const authClient = createCliAuthClient(baseURL);

  const spinner = clack.spinner();

  // 1. Request device code
  const { data: codeData, error: codeError } = await authClient.device.code({
    client_id: "wraps-cli",
  });

  if (codeError || !codeData) {
    clack.log.error("Failed to start device authorization.");
    process.exit(1);
  }

  const {
    device_code,
    user_code,
    verification_uri: _verificationUri,
    interval,
    expires_in,
  } = codeData;

  // Format code as XXXX-XXXX for display
  const formatted = `${user_code.slice(0, 4)}-${user_code.slice(4)}`;

  clack.log.info(`Your code:  ${pc.bold(pc.cyan(formatted))}`);
  clack.log.info(`Visit: ${pc.underline(`${baseURL}/device`)}`);

  // Try opening browser with pre-filled code
  try {
    await open(`${baseURL}/device?user_code=${user_code}`);
    clack.log.info("Opening browser...");
  } catch {
    // Browser didn't open, user will navigate manually
  }

  spinner.start("Waiting for approval...");

  // 2. Poll for token
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

      // Fetch user's organizations
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

      clack.log.success("Signed in successfully.");

      if (organizations.length === 1) {
        clack.log.info(`Organization: ${pc.cyan(organizations[0].name)}`);
      } else if (organizations.length > 1) {
        clack.log.info(`${organizations.length} organizations available`);
      }

      if (options.json) {
        console.log(
          JSON.stringify({
            success: true,
            tokenType: "session",
            organizations,
          })
        );
      }

      return;
    }

    if (tokenError) {
      const errorCode = (tokenError as any).error || (tokenError as any).code;

      if (errorCode === "authorization_pending") continue;

      if (errorCode === "slow_down") {
        await new Promise((r) => setTimeout(r, pollInterval));
        continue;
      }

      if (errorCode === "access_denied") {
        spinner.stop("Denied.");
        clack.log.error("Authorization was denied.");
        process.exit(1);
      }

      if (errorCode === "expired_token") break;
    }
  }

  spinner.stop("Expired.");
  clack.log.error("Device code expired. Run `wraps auth login` to try again.");
  process.exit(1);
}
