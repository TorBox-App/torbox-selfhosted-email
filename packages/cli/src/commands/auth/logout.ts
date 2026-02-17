import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import { clearAuthConfig, readAuthConfig } from "../../utils/shared/config.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";

export async function logout(): Promise<void> {
  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps \u203A Sign Out"));
  }

  const config = await readAuthConfig();
  if (!config?.auth?.token) {
    trackCommand("auth:logout", { success: true, already_logged_out: true });
    if (isJsonMode()) {
      jsonSuccess("auth.logout", { loggedOut: false, alreadyLoggedOut: true });
      return;
    }
    clack.log.info("Not signed in.");
    return;
  }

  await clearAuthConfig();
  trackCommand("auth:logout", { success: true });

  if (isJsonMode()) {
    jsonSuccess("auth.logout", { loggedOut: true });
    return;
  }

  clack.log.success("Signed out. Token removed from ~/.wraps/config.json");
}
