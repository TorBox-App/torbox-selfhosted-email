import * as clack from "@clack/prompts";
import pc from "picocolors";
import { clearAuthConfig, readAuthConfig } from "../../utils/shared/config.js";

export async function logout(): Promise<void> {
  clack.intro(pc.bold("Wraps \u203A Sign Out"));

  const config = await readAuthConfig();
  if (!config?.auth?.token) {
    clack.log.info("Not signed in.");
    return;
  }

  await clearAuthConfig();
  clack.log.success("Signed out. Token removed from ~/.wraps/config.json");
}
