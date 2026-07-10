#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copy Lambda functions from @wraps/core for production use
 *
 * This script copies pre-bundled Lambda functions from @wraps/core into the CLI's
 * dist/lambda directory so they're available when the CLI is published.
 *
 * The @wraps/core package is bundled into the CLI (noExternal), but import.meta.url
 * paths don't work correctly when bundled. So we copy the Lambda files directly.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");
const corePackageRoot = join(packageRoot, "..", "core");

function copyLambda(name: string) {
  const sourcePath = join(corePackageRoot, "lambda", name);
  const destPath = join(packageRoot, "dist", "lambda", name);

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Lambda source not found: ${sourcePath}\n` +
        "Make sure @wraps/core is built first: pnpm --filter @wraps/core build"
    );
  }

  // Check that source has been bundled
  const bundleMarker = join(sourcePath, ".bundled");
  if (!existsSync(bundleMarker)) {
    throw new Error(
      `Lambda not bundled: ${sourcePath}\n` +
        "Make sure @wraps/core is built first: pnpm --filter @wraps/core build"
    );
  }

  // Create destination directory
  if (!existsSync(dirname(destPath))) {
    mkdirSync(dirname(destPath), { recursive: true });
  }

  // Copy the entire Lambda directory
  cpSync(sourcePath, destPath, { recursive: true });

  console.log(`✓ Copied ${name} -> dist/lambda/${name}/`);
}

async function main() {
  console.log("Copying Lambda functions from @wraps/core...\n");

  copyLambda("event-processor");
  copyLambda("sms-event-processor");
  copyLambda("inbound-processor");
  copyLambda("agent-enforcer");

  console.log("\n✓ Lambda setup complete");
}

main().catch((error) => {
  console.error("Failed to bundle Lambda functions:", error);
  process.exit(1);
});
