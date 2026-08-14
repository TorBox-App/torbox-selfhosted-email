import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..", "..", "..", "..");
const cliSrcDir = resolve(repoRoot, "packages/cli/src");
const pageContentPath = resolve(
  repoRoot,
  "apps/website/src/app/docs/reference/errors/page-content.tsx"
);

// JSON-mode fallback used by handleCLIError when the thrown value is not a
// WrapsError (packages/cli/src/utils/shared/errors.ts:364, `let code =
// "UNKNOWN_ERROR"`). It is never the second argument to `new WrapsError(`,
// so the extraction below can't find it — add it by hand instead of
// loosening the regex.
const UNKNOWN_ERROR_FALLBACK_CODE = "UNKNOWN_ERROR";

// Fictional codes the docs page used to document before this page was
// rewritten from CLI source. None of these are ever emitted by the CLI.
const FICTIONAL_CODES = [
  "CREDENTIALS_NOT_FOUND",
  "MISSING_PERMISSIONS",
  "STACK_NOT_FOUND",
  "DOMAIN_NOT_VERIFIED",
  "SES_SANDBOX",
];

/**
 * Walk packages/cli/src (skipping tests) and extract every code passed as
 * the second argument to `new WrapsError(...)`. This is the same rule used
 * to write apps/website/src/app/docs/reference/errors/page-content.tsx —
 * see plan 119.
 */
function extractCliErrorCodes(): Set<string> {
  const codes = new Set<string>();
  const entries = readdirSync(cliSrcDir, {
    recursive: true,
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }
    if (entry.name.endsWith(".test.ts")) {
      continue;
    }
    const parentPath =
      (entry as { parentPath?: string; path?: string }).parentPath ??
      (entry as { path?: string }).path;
    if (!parentPath || parentPath.includes("__tests__")) {
      continue;
    }

    const filePath = resolve(parentPath, entry.name);
    const source = readFileSync(filePath, "utf8");
    const callRe = /new WrapsError\(/g;
    let match: RegExpExecArray | null = callRe.exec(source);
    while (match !== null) {
      const chunk = source.slice(match.index, match.index + 2000);
      const codeMatch = chunk.match(/,\s*\n?\s*"([A-Z][A-Z0-9_]{2,})"/);
      if (codeMatch) {
        codes.add(codeMatch[1]);
      }
      match = callRe.exec(source);
    }
  }

  return codes;
}

describe("CLI error codes documented on the errors reference page", () => {
  it("extracted a plausible number of codes from packages/cli/src", () => {
    const codes = extractCliErrorCodes();
    // A broken regex (e.g. one that never matches) would make the coverage
    // assertion below vacuously pass. Guard against that directly.
    expect(codes.size).toBeGreaterThanOrEqual(80);
  });

  it("documents every CLI error code the CLI can actually emit", () => {
    const codes = extractCliErrorCodes();
    codes.add(UNKNOWN_ERROR_FALLBACK_CODE);

    const pageContent = readFileSync(pageContentPath, "utf8");
    // Word-boundary match, not `.includes()` — a plain substring check is
    // satisfied by any longer code that contains a shorter one (e.g.
    // REGION_REQUIRED_FOR_SET silently "covers" REGION_REQUIRED), which
    // would let a documented code disappear without the test noticing.
    const missing = [...codes].filter(
      (code) => !new RegExp(`\\b${code}\\b`).test(pageContent)
    );

    expect(
      missing,
      `The following CLI error codes are not documented on the errors reference page. Add them to CLI_ERROR_SECTIONS in ${pageContentPath}:\n${missing.join(", ")}`
    ).toEqual([]);
  });

  it("no longer documents the fictional error codes it used to invent", () => {
    const pageContent = readFileSync(pageContentPath, "utf8");
    const stillPresent = FICTIONAL_CODES.filter((code) => {
      const wordBoundaryRe = new RegExp(`\\b${code}\\b`);
      return wordBoundaryRe.test(pageContent);
    });

    expect(stillPresent).toEqual([]);
  });
});
