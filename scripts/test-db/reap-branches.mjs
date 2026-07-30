#!/usr/bin/env node
// Manual sweep of orphaned per-worktree Neon test-database branches.
//
// Usage:
//   node scripts/test-db/reap-branches.mjs        — delete wt-* branches
//                                                     whose worktree no
//                                                     longer exists
//   node scripts/test-db/reap-branches.mjs --all   — also delete LIVE wt-*
//                                                     branches; use this
//                                                     after running new
//                                                     Drizzle migrations on
//                                                     the shared test DB, to
//                                                     force every worktree
//                                                     onto a fresh branch
//                                                     with current schema
//
// Reads apps/web/.env.test directly (no dotenv dependency) so it works
// standalone, regardless of cwd.

import { readFileSync } from "node:fs";
import path from "node:path";
import { reapOrphanBranches } from "./resolve-branch.mjs";

const ENV_TEST_PATH = path.resolve(
  import.meta.dirname,
  "../../apps/web/.env.test"
);

/**
 * Minimal `KEY=value` .env parser — skips comments/blank lines, strips
 * surrounding quotes. Intentionally not a dependency: this script must run
 * standalone with no install step.
 *
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function loadEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const env = {};
  let contents;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    return env;
  }

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function main() {
  const all = process.argv.includes("--all");
  const env = { ...loadEnvFile(ENV_TEST_PATH), ...process.env };

  const { deleted, kept, failed } = await reapOrphanBranches(env, { all });

  console.log(`deleted: [${deleted.join(", ")}] (${deleted.length})`);
  console.log(`kept: [${kept.join(", ")}] (${kept.length})`);
  if (failed.length > 0) {
    console.log(`failed: [${failed.join(", ")}] (${failed.length})`);
  }

  // Exit 1 only when the API key is present, at least one delete was
  // attempted, and every single attempt failed. "Nothing to delete" and
  // "some succeeded" both exit 0.
  const attempted = deleted.length + failed.length;
  const hasKey = Boolean(env.NEON_API_KEY && env.NEON_PROJECT_ID);
  if (hasKey && attempted > 0 && deleted.length === 0) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(
    `[test-db] reap-branches failed: ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
});
