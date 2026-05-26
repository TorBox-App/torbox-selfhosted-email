#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

/**
 * Build the selfhost API Lambda and copy migrations into dist/ so they're
 * available to the installed CLI without needing the monorepo at runtime.
 *
 * Outputs:
 *   dist/api-lambda.zip         — pre-built Lambda zip for selfhost deploy/upgrade
 *   dist/selfhost-migrations/   — SQL migration files for programmatic migration
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");
const repoRoot = join(packageRoot, "..", "..");
const apiDir = join(repoRoot, "apps", "api");
const apiDistDir = join(apiDir, "dist");
const dbMigrationsDir = join(repoRoot, "packages", "db", "src", "migrations");
const cliDistDir = join(packageRoot, "dist");
const outputZip = join(cliDistDir, "api-lambda.zip");
const outputMigrationsDir = join(cliDistDir, "selfhost-migrations");

if (!existsSync(cliDistDir)) {
  mkdirSync(cliDistDir, { recursive: true });
}

console.log("Building Wraps API for selfhost...");
execSync("bun build src/lambda.ts --outdir dist --target node", {
  cwd: apiDir,
  stdio: "inherit",
});

// Node 22 treats .js as CJS unless package.json declares "type":"module"
writeFileSync(join(apiDistDir, "package.json"), '{"type":"module"}\n');

console.log("Packaging Lambda zip...");
execSync(`zip -r "${outputZip}" .`, { cwd: apiDistDir, stdio: "inherit" });
console.log(`✓ dist/api-lambda.zip`);

console.log("Copying selfhost migrations...");
if (existsSync(outputMigrationsDir)) {
  // Clear existing so stale migrations don't linger between builds
  execSync(`rm -rf "${outputMigrationsDir}"`);
}
mkdirSync(outputMigrationsDir, { recursive: true });
// Copy only .sql files (skip snapshots — not needed for runtime migration)
cpSync(dbMigrationsDir, outputMigrationsDir, {
  recursive: true,
  filter: (src) => {
    if (src === dbMigrationsDir) return true;
    return src.endsWith(".sql");
  },
});
console.log(`✓ dist/selfhost-migrations/`);
