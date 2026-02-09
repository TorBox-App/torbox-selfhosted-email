import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

function readFile(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf-8");
}

function findFiles(pattern: string): string[] {
  return globSync(pattern, { cwd: ROOT }).map((f) => f.toString());
}

// ─────────────────────────────────────────────────────────
// Test 1: Organization-scoped queries
// ─────────────────────────────────────────────────────────

// Tables that have an organizationId column and MUST be scoped in queries.
const ORG_SCOPED_TABLES = new Set([
  "contact",
  "topic",
  "topicSettings",
  "template",
  "reusableBlock",
  "templateVariable",
  "brandKit",
  "aiConversation",
  "workflow",
  "workflowExecution",
  "awsAccount",
  "apiKey",
  "auditLog",
  "batchSend",
  "messageSend",
  "segment",
  "contactEvent",
  "emailTemplate",
  "organizationExtension",
  "member",
  "invitation",
  "statement",
  "aiUsageMonthly",
  "aiUsageLog",
  "apiUsageDaily",
  "apiRateLimitWindow",
  "messageUsageMonthly",
  "eventUsageMonthly",
]);

// Files excluded from org-scope checks.
// These validate org ownership through alternative mechanisms.
const ORG_SCOPE_EXCLUDED_FILES = new Set([
  // Webhook handlers authenticate via SES webhook secret → awsAccount lookup
  "apps/api/src/routes/webhooks.ts",
  // Internal services called by org-validated routes
  "apps/api/src/services/workflow-events.ts",
  "apps/api/src/services/segment-evaluator.ts",
  "apps/api/src/services/credentials.ts",
  "apps/api/src/services/workflow-queue.ts",
  "apps/api/src/services/workflow-scheduler.ts",
]);

// Queries that scan routes + actions for org-scoped table operations
const QUERY_FILE_PATTERNS = [
  "apps/api/src/routes/**/*.ts",
  "apps/api/src/services/**/*.ts",
  "apps/web/src/actions/**/*.ts",
];

function getQueryFiles(): string[] {
  return QUERY_FILE_PATTERNS.flatMap(findFiles).filter(
    (f) =>
      !(
        f.includes("__tests__") ||
        f.includes(".test.") ||
        ORG_SCOPE_EXCLUDED_FILES.has(f)
      )
  );
}

/**
 * Scans for .operation(tableName) and checks if organizationId
 * appears within a window around the query. Uses a generous window
 * since Drizzle queries span many lines.
 */
function findMissingScopeViolations(
  operation: string,
  windowBefore: number,
  windowAfter: number
): string[] {
  const violations: string[] = [];
  const files = getQueryFiles();
  const regex = new RegExp(`\\.${operation}\\((\\w+)\\)`, "g");

  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");
    for (const match of content.matchAll(regex)) {
      const tableName = match[1];
      if (!ORG_SCOPED_TABLES.has(tableName)) continue;

      // Check if this line has a guardrail:allow-unscoped comment
      const lineStart = content.lastIndexOf("\n", match.index) + 1;
      const lineEnd = content.indexOf("\n", match.index);
      const line = content.slice(
        lineStart,
        lineEnd === -1 ? undefined : lineEnd
      );
      if (line.includes("guardrail:allow-unscoped")) continue;

      const beforeMatch = content.slice(0, match.index);
      const lineNum = beforeMatch.split("\n").length;

      const windowStart = Math.max(lineNum - 1 - windowBefore, 0);
      const windowEnd = Math.min(lineNum + windowAfter, lines.length);
      const window = lines.slice(windowStart, windowEnd).join("\n");

      if (!window.includes("organizationId")) {
        violations.push(
          `${file}:${lineNum} — .${operation}(${tableName}) missing organizationId`
        );
      }
    }
  }

  return violations;
}

describe("org-scoped queries", () => {
  // Large window: org validation often happens 30+ lines before the query
  // in server actions (session check → org lookup → business logic → query)

  // Window sizes are generous because server actions validate org ownership
  // at the top of the function, then have many lines of business logic
  // before the actual query.

  test("UPDATE queries on org-scoped tables include organizationId", () => {
    const violations = findMissingScopeViolations("update", 80, 15);
    expect(violations, violations.join("\n")).toEqual([]);
  });

  test("DELETE queries on org-scoped tables include organizationId", () => {
    const violations = findMissingScopeViolations("delete", 80, 15);
    expect(violations, violations.join("\n")).toEqual([]);
  });

  test("SELECT queries on org-scoped tables include organizationId", () => {
    const violations = findMissingScopeViolations("from", 80, 25);
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 2: Server actions catch ServerValidateError
// ─────────────────────────────────────────────────────────

describe("server actions handle ServerValidateError", () => {
  test("files using createServerValidate must catch formState errors", () => {
    const actionFiles = findFiles("apps/web/src/actions/**/*.ts").filter(
      (f) => !(f.includes("__tests__") || f.includes(".test."))
    );

    const violations: string[] = [];

    for (const file of actionFiles) {
      const content = readFile(file);
      if (!content.includes("createServerValidate")) continue;

      // Must handle formState somewhere (either return it or re-throw)
      if (!content.includes("formState")) {
        violations.push(
          `${file} — uses createServerValidate but never handles formState in catch block`
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 3: API route handlers await all async operations
// ─────────────────────────────────────────────────────────

describe("API routes await async operations", () => {
  test("no fire-and-forget .catch() without await", () => {
    const routeFiles = findFiles("apps/api/src/routes/**/*.ts").filter(
      (f) => !(f.includes("__tests__") || f.includes(".test."))
    );

    const violations: string[] = [];

    for (const file of routeFiles) {
      const content = readFile(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes(".catch(")) continue;

        // Skip comments
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        // Check if `await` appears in the preceding 15 lines (multiline expressions
        // with large argument objects can span many lines)
        const lookbackStart = Math.max(0, i - 15);
        const lookbackWindow = lines.slice(lookbackStart, i + 1).join("\n");

        if (
          lookbackWindow.includes("await ") ||
          lookbackWindow.includes("await\n")
        ) {
          continue;
        }

        // Skip if inside a Promise.all (which is itself awaited)
        const broaderStart = Math.max(0, i - 25);
        const broaderWindow = lines.slice(broaderStart, i + 1).join("\n");
        if (broaderWindow.includes("Promise.all")) continue;

        violations.push(
          `${file}:${i + 1} — .catch() without await (possible fire-and-forget): ${trimmed.slice(0, 80)}`
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 4: No private env vars in client components
// ─────────────────────────────────────────────────────────

describe("client components do not access private env vars", () => {
  test("no process.env access to non-NEXT_PUBLIC_ vars in 'use client' files", () => {
    const clientFiles = findFiles("apps/web/src/**/*.{ts,tsx}").filter(
      (f) => !(f.includes("__tests__") || f.includes(".test."))
    );

    const violations: string[] = [];

    for (const file of clientFiles) {
      const content = readFile(file);

      // Only check client components
      if (
        !(
          content.startsWith('"use client"') ||
          content.startsWith("'use client'")
        )
      ) {
        continue;
      }

      const lines = content.split("\n");
      const envRegex = /process\.env\.([A-Z_]+)/g;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        // Skip lines inside template literals (code examples in UI)
        const beforeLine = lines.slice(0, i).join("\n");
        const backticksBefore = (beforeLine.match(/`/g) || []).length;
        if (backticksBefore % 2 === 1) continue;

        envRegex.lastIndex = 0;

        for (const match of line.matchAll(envRegex)) {
          const varName = match[1];
          // NEXT_PUBLIC_ vars are inlined by Next.js at build time — safe
          if (varName.startsWith("NEXT_PUBLIC_")) continue;
          // NODE_ENV is always available
          if (varName === "NODE_ENV") continue;

          violations.push(
            `${file}:${i + 1} — client component accesses private env var: process.env.${varName}`
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 5: No arbitrary hex colors or hardcoded white/black
// ─────────────────────────────────────────────────────────

// Matches arbitrary hex color values in Tailwind classes like bg-[#abc123], text-[#fff]
const ARBITRARY_HEX_REGEX =
  /(?:bg|text|border|ring|outline|shadow|accent|caret|fill|stroke|decoration)-\[#[0-9a-fA-F]+\]/g;

// Matches hardcoded white/black Tailwind classes that break dark mode
const HARDCODED_WHITE_BLACK_REGEX =
  /(?<!\w)(?:bg|text|border|ring|outline|shadow|accent|caret|fill|stroke|decoration)-(?:white|black)(?!\w)/g;

// Directories excluded from color checks (design primitives, not app code)
const COLOR_EXCLUDED_PATTERNS = ["/components/ui/", "/node_modules/"];

function getComponentFiles(appPattern: string): string[] {
  return findFiles(appPattern).filter(
    (f) =>
      !(
        f.includes("__tests__") ||
        f.includes(".test.") ||
        COLOR_EXCLUDED_PATTERNS.some((p) => f.includes(p))
      )
  );
}

function findColorViolations(
  files: string[],
  regex: RegExp,
  label: string
): string[] {
  const violations: string[] = [];

  for (const file of files) {
    const content = readFile(file);
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      // Skip lines with escape hatch
      if (line.includes("guardrail:allow-color")) continue;

      regex.lastIndex = 0;

      for (const match of line.matchAll(regex)) {
        violations.push(`${file}:${i + 1} — ${label}: ${match[0]}`);
      }
    }
  }

  return violations;
}

describe("Tailwind color guardrails", () => {
  test("no arbitrary hex colors in web app components", () => {
    const files = getComponentFiles("apps/web/src/**/*.{ts,tsx}");
    const violations = findColorViolations(
      files,
      ARBITRARY_HEX_REGEX,
      "arbitrary hex color"
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });

  // Ratchet: website has 41 existing violations. This prevents new ones
  // from being added. Lower this number as violations are cleaned up.
  test("no new arbitrary hex colors in website components", () => {
    const files = getComponentFiles("apps/website/src/**/*.{ts,tsx}");
    const violations = findColorViolations(
      files,
      ARBITRARY_HEX_REGEX,
      "arbitrary hex color"
    );
    expect(
      violations.length,
      `Expected ≤41 violations but found ${violations.length}. New arbitrary hex colors added:\n${violations.join("\n")}`
    ).toBeLessThanOrEqual(41);
  });

  // Ratchet: web app has 177 existing white/black violations. This prevents
  // new ones from being added. Lower this number as violations are cleaned up.
  test("no new hardcoded white/black in web app", () => {
    const files = getComponentFiles("apps/web/src/**/*.{ts,tsx}");
    const violations = findColorViolations(
      files,
      HARDCODED_WHITE_BLACK_REGEX,
      "hardcoded white/black (use theme colors for dark mode support)"
    );
    expect(
      violations.length,
      `Expected ≤177 violations but found ${violations.length}. New hardcoded white/black added:\n${violations.join("\n")}`
    ).toBeLessThanOrEqual(177);
  });
});

// ─────────────────────────────────────────────────────────
// Test 6: No direct @radix-ui imports outside UI wrappers
// ─────────────────────────────────────────────────────────

describe("no direct @radix-ui imports outside UI wrappers", () => {
  test("app code must import from packages/ui, not @radix-ui directly", () => {
    const appFiles = [
      ...findFiles("apps/web/src/**/*.{ts,tsx}"),
      ...findFiles("apps/website/src/**/*.{ts,tsx}"),
    ].filter(
      (f) =>
        !(
          f.includes("__tests__") ||
          f.includes(".test.") ||
          f.includes("/components/ui/")
        )
    );

    const violations: string[] = [];
    const radixImportRegex = /from\s+['"]@radix-ui\//g;

    for (const file of appFiles) {
      const content = readFile(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (radixImportRegex.test(line)) {
          violations.push(
            `${file}:${i + 1} — import from @radix-ui directly (use packages/ui wrapper instead)`
          );
        }
        radixImportRegex.lastIndex = 0;
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 7: No @tanstack/react-form in server components
// ─────────────────────────────────────────────────────────

describe("no client-only imports in server components", () => {
  test("@tanstack/react-form must only be imported in 'use client' files", () => {
    const files = findFiles("apps/web/src/**/*.{ts,tsx}").filter(
      (f) =>
        !(
          f.includes("__tests__") ||
          f.includes(".test.") ||
          f.includes("/lib/forms/")
        )
    );

    const violations: string[] = [];

    for (const file of files) {
      const content = readFile(file);
      if (!content.includes("@tanstack/react-form")) continue;

      const isClient =
        content.startsWith('"use client"') ||
        content.startsWith("'use client'");

      if (!isClient) {
        // Check if it's a pure type import or the server-safe nextjs subpath
        const lines = content.split("\n");
        const hasClientOnlyImport = lines.some(
          (line) =>
            line.includes("@tanstack/react-form") &&
            !line.includes("@tanstack/react-form-nextjs") &&
            !line.includes("@tanstack/react-form/nextjs") &&
            !line.trim().startsWith("//") &&
            !line.includes("import type")
        );

        if (hasClientOnlyImport) {
          violations.push(
            `${file} — imports @tanstack/react-form but is not a 'use client' component`
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 8: No redirect() inside try/catch
// ─────────────────────────────────────────────────────────

describe("no redirect() inside try/catch", () => {
  test("Next.js redirect() must not be called inside try blocks", () => {
    const files = findFiles("apps/web/src/**/*.{ts,tsx}").filter(
      (f) => !(f.includes("__tests__") || f.includes(".test."))
    );

    const violations: string[] = [];

    for (const file of files) {
      const content = readFile(file);

      // Only check files that import redirect from next/navigation
      if (!content.includes('from "next/navigation"')) continue;
      if (!(content.includes("redirect(") || content.includes("redirect,")))
        continue;

      // Simple brace-depth tracker: find try blocks and check for redirect inside
      const lines = content.split("\n");
      let inTryBlock = false;
      let tryDepth = 0;
      let braceDepth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        // Detect try block start
        if (/\btry\s*\{/.test(line)) {
          inTryBlock = true;
          tryDepth = braceDepth;
        }

        // Track brace depth
        for (const char of line) {
          if (char === "{") braceDepth++;
          if (char === "}") {
            braceDepth--;
            // Exiting the try block
            if (inTryBlock && braceDepth === tryDepth) {
              inTryBlock = false;
            }
          }
        }

        // Check for redirect() inside try block
        if (inTryBlock && /\bredirect\(/.test(line)) {
          violations.push(
            `${file}:${i + 1} — redirect() inside try/catch (redirect throws internally and will be swallowed)`
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 9: No console.log in web app
// ─────────────────────────────────────────────────────────

describe("no console.log in web app", () => {
  test("no console.log calls in web app", () => {
    const files = findFiles("apps/web/src/**/*.{ts,tsx}").filter(
      (f) => !(f.includes("__tests__") || f.includes(".test."))
    );

    const violations: string[] = [];
    const consoleLogRegex = /console\.log\(/g;

    for (const file of files) {
      const content = readFile(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        // Skip lines inside template literals (code examples in UI)
        const beforeLine = lines.slice(0, i).join("\n");
        const backticksBefore = (beforeLine.match(/`/g) || []).length;
        if (backticksBefore % 2 === 1) continue;

        // Skip lines with escape hatch
        if (line.includes("guardrail:allow-console")) continue;

        consoleLogRegex.lastIndex = 0;
        if (consoleLogRegex.test(line)) {
          violations.push(`${file}:${i + 1} — console.log() call`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 10: No swallowed errors in CLI commands
// ─────────────────────────────────────────────────────────

function getCLICommandFiles(): string[] {
  return findFiles("packages/cli/src/commands/**/*.ts").filter(
    (f) => !(f.includes("__tests__") || f.includes(".test."))
  );
}

describe("no swallowed errors in CLI commands", () => {
  test("catch blocks must not ignore errors via _error or bare catch", () => {
    const files = getCLICommandFiles();
    const violations: string[] = [];

    // Matches catch(_error), catch (_error: any), catch (_error: unknown), etc.
    const underscoredCatchRegex = /catch\s*\(\s*_error/;
    // Matches bare catch { (no variable captured at all)
    const bareCatchRegex = /\)\s*catch\s*\{|^\s*}\s*catch\s*\{/;

    for (const file of files) {
      const content = readFile(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        // Skip lines with escape hatch (check current line and next line,
        // since the formatter may split `catch { // comment` across two lines)
        if (line.includes("guardrail:allow-swallowed-error")) continue;
        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        if (nextLine.includes("guardrail:allow-swallowed-error")) continue;

        if (underscoredCatchRegex.test(line) || bareCatchRegex.test(line)) {
          violations.push(
            `${file}:${i + 1} — swallowed error (use specific error checks instead)`
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 11: No catch (error: any) in CLI commands
// ─────────────────────────────────────────────────────────

describe("no catch (error: any) in CLI commands", () => {
  test("catch blocks must use unknown type, not any", () => {
    const files = getCLICommandFiles();
    const violations: string[] = [];

    const catchAnyRegex = /catch\s*\(\s*\w+\s*:\s*any\s*\)/;

    for (const file of files) {
      const content = readFile(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        // Skip lines with escape hatch
        if (line.includes("guardrail:allow-catch-any")) continue;

        if (catchAnyRegex.test(line)) {
          violations.push(
            `${file}:${i + 1} — catch (error: any) should be catch (error) with type guards`
          );
        }
      }
    }

    // Ratchet: 0 — all violations fixed.
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 12: No metadata save before deployment completes
// ─────────────────────────────────────────────────────────

describe("metadata save order", () => {
  test("saveConnectionMetadata must not appear before deployment calls in same function", () => {
    const files = getCLICommandFiles();
    const violations: string[] = [];

    const saveRegex = /saveConnectionMetadata\s*\(/g;
    const deployRegex =
      /stack\.up\s*\(|deployEmailStack\s*\(|deploySmsStack\s*\(|deployCdnStack\s*\(/g;

    for (const file of files) {
      const content = readFile(file);

      // Only check files that have both save and deploy
      if (
        !(
          content.includes("saveConnectionMetadata") &&
          (content.includes("stack.up") ||
            content.includes("deployEmailStack") ||
            content.includes("deploySmsStack") ||
            content.includes("deployCdnStack"))
        )
      ) {
        continue;
      }

      const lines = content.split("\n");

      // Find all save and deploy line numbers
      const saveLines: number[] = [];
      const deployLines: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("guardrail:allow-early-save")) continue;

        saveRegex.lastIndex = 0;
        deployRegex.lastIndex = 0;

        if (saveRegex.test(line)) {
          saveLines.push(i + 1);
        }
        if (deployRegex.test(line)) {
          deployLines.push(i + 1);
        }
      }

      if (saveLines.length === 0 || deployLines.length === 0) continue;

      // Check if any save appears before the first deploy
      const firstDeploy = Math.min(...deployLines);
      for (const saveLine of saveLines) {
        if (saveLine < firstDeploy) {
          violations.push(
            `${file}:${saveLine} — saveConnectionMetadata before deployment at line ${firstDeploy}`
          );
        }
      }
    }

    // Ratchet: 0 expected violations.
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// Test 13: No duplicate infrastructure helper functions
// ─────────────────────────────────────────────────────────

describe("no duplicate infrastructure helpers", () => {
  test("resource-check functions must not be duplicated across files", () => {
    const files = findFiles("packages/cli/src/infrastructure/**/*.ts").filter(
      (f) => !(f.includes("__tests__") || f.includes(".test."))
    );

    // Track function declarations
    const functionLocations: Record<string, string[]> = {};
    const funcDeclRegex =
      /(?:async\s+)?function\s+(roleExists|tableExists|sqsQueueExists|snsTopicExists|lambdaFunctionExists)\s*\(/g;

    for (const file of files) {
      const content = readFile(file);

      funcDeclRegex.lastIndex = 0;
      for (const match of content.matchAll(funcDeclRegex)) {
        const funcName = match[1];
        if (!functionLocations[funcName]) {
          functionLocations[funcName] = [];
        }
        functionLocations[funcName].push(file);
      }
    }

    const violations: string[] = [];
    for (const [funcName, locations] of Object.entries(functionLocations)) {
      if (locations.length > 1) {
        violations.push(`${funcName}() duplicated in: ${locations.join(", ")}`);
      }
    }

    // Ratchet: 0 — all helpers extracted to shared/resource-checks.ts.
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
