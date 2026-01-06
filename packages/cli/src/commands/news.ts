/**
 * News command - Show recent Wraps updates
 * @module commands/news
 */

import * as clack from "@clack/prompts";
import pc from "picocolors";

/**
 * Display recent Wraps updates and changelog information
 */
export async function news(): Promise<void> {
  clack.intro(pc.bold("What's New in Wraps"));

  console.log();
  console.log("  See the latest updates, features, and improvements:");
  console.log();
  console.log(`  ${pc.cyan("→")} ${pc.bold("Changelog:")} ${pc.cyan("https://wraps.dev/changelog")}`);
  console.log();
  console.log(pc.dim("  Subscribe to get notified about new releases."));
  console.log();
}
