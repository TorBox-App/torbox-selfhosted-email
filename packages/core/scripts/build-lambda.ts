/**
 * Build script for bundling Lambda function code
 *
 * This script bundles the Lambda functions using esbuild
 * and creates a .bundled marker file to indicate the code is ready.
 *
 * The bundled code is placed in the `lambda/` directory
 * and will be packaged with the npm package for distribution.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

async function buildLambda(name: string): Promise<void> {
  const sourcePath = join(packageRoot, "lambda", name, "index.ts");
  const outDir = join(packageRoot, "lambda", name);
  const outFile = join(outDir, "index.mjs");
  const markerFile = join(outDir, ".bundled");

  // Create output directory if needed
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Check if source exists
  if (!existsSync(sourcePath)) {
    console.error(`Lambda source not found: ${sourcePath}`);
    process.exit(1);
  }

  console.log(`Building Lambda: ${name}`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Output: ${outFile}`);

  // Bundle with esbuild
  await build({
    entryPoints: [sourcePath],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: outFile,
    external: ["@aws-sdk/*"], // AWS SDK v3 is included in Lambda runtime
    minify: true,
    sourcemap: false,
  });

  // Create marker file to indicate successful build
  writeFileSync(markerFile, `Built at: ${new Date().toISOString()}\n`);

  console.log("  Done!");
}

async function main() {
  console.log("Building Lambda functions...\n");

  // Build email event processor
  await buildLambda("event-processor");

  // Build SMS event processor
  await buildLambda("sms-event-processor");

  console.log("\nAll Lambda functions built successfully!");
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
