import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import { readAuthConfig } from "../../utils/shared/config.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";

type StatusOptions = { json?: boolean };

export async function authStatus(_options: StatusOptions = {}): Promise<void> {
  const config = await readAuthConfig();

  if (!config?.auth?.token) {
    trackCommand("auth:status", { success: true, authenticated: false });
    if (isJsonMode()) {
      jsonSuccess("auth.status", { authenticated: false });
    } else {
      clack.intro(pc.bold("Wraps \u203A Auth Status"));
      clack.log.info("Not signed in. Run `wraps auth login` to authenticate.");
    }
    return;
  }

  const { token, tokenType, expiresAt } = config.auth;
  const masked =
    tokenType === "api-key"
      ? `${token.slice(0, 15)}...`
      : `${token.slice(0, 10)}...`;

  if (isJsonMode()) {
    jsonSuccess("auth.status", {
      authenticated: true,
      tokenType,
      tokenPrefix: masked,
      expiresAt: expiresAt || null,
    });
  } else {
    clack.intro(pc.bold("Wraps \u203A Auth Status"));
    clack.log.info(`Token:   ${masked} (${tokenType})`);
    if (expiresAt) {
      clack.log.info(`Expires: ${new Date(expiresAt).toLocaleDateString()}`);
    }
  }

  trackCommand("auth:status", { success: true, authenticated: true });
}
