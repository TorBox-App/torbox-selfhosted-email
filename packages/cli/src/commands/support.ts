/**
 * Support command - Get help and support contact info
 * @module commands/support
 */

import * as clack from "@clack/prompts";
import pc from "picocolors";

/**
 * Display support contact information and helpful links
 */
export async function support(): Promise<void> {
  clack.intro(pc.bold("Get Help with Wraps"));

  console.log();
  console.log(`  ${pc.bold("Email:")}   ${pc.cyan("hey@wraps.sh")}`);
  console.log(
    `  ${pc.bold("GitHub:")}  ${pc.cyan("https://github.com/wraps-dev/wraps/issues")}`
  );
  console.log(`  ${pc.bold("Docs:")}    ${pc.cyan("https://wraps.dev/docs")}`);
  console.log();
  console.log(pc.dim("  Response time: Usually within 24 hours"));
  console.log();
}
