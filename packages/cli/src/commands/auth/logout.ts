import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import { clearAuthConfig, readAuthConfig } from "../../utils/shared/config.js";

export async function logout(): Promise<void> {
  clack.intro(pc.bold("Wraps \u203A Sign Out"));

  const config = await readAuthConfig();
  if (!config?.auth?.token) {
    trackCommand("auth:logout", { success: true, already_logged_out: true });
    clack.log.info("Not signed in.");
    return;
  }

  await clearAuthConfig();
  trackCommand("auth:logout", { success: true });
  clack.log.success("Signed out. Token removed from ~/.wraps/config.json");
}
