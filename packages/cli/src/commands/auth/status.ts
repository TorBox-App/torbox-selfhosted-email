import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import { resolveApiTarget } from "../../utils/shared/api-target.js";
import { readAuthConfig } from "../../utils/shared/config.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";

type StatusOptions = { json?: boolean };

/**
 * Reports the plane the CLI is actually pointed at. Reading only the SaaS slot
 * told a signed-in self-hosted customer they were signed out.
 */
export async function authStatus(_options: StatusOptions = {}): Promise<void> {
  const target = await resolveApiTarget();
  const instance = target.selfhosted ? target.appUrl : null;

  if (!target.token) {
    trackCommand("auth:status", { success: true, authenticated: false });
    if (isJsonMode()) {
      jsonSuccess("auth.status", { authenticated: false, instance });
    } else {
      clack.intro(pc.bold("Wraps › Auth Status"));
      clack.log.info(
        `Not signed in. Run \`${target.loginCommand}\` to authenticate.`
      );
    }
    return;
  }

  const config = await readAuthConfig();
  const expiresAt = instance
    ? config?.selfhost?.[instance]?.expiresAt
    : config?.auth?.expiresAt;
  const { token, tokenType } = target;
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
      instance,
    });
  } else {
    clack.intro(pc.bold("Wraps › Auth Status"));
    if (instance) {
      clack.log.info(`Instance: ${pc.cyan(instance)} (self-hosted)`);
    }
    clack.log.info(`Token:   ${masked} (${tokenType})`);
    if (expiresAt) {
      clack.log.info(`Expires: ${new Date(expiresAt).toLocaleDateString()}`);
    }
  }

  trackCommand("auth:status", { success: true, authenticated: true });
}
