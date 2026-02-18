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

      // Check if this line has a baseline:allow-unscoped comment
      const lineStart = content.lastIndexOf("\n", match.index) + 1;
      const lineEnd = content.indexOf("\n", match.index);
      const line = content.slice(
        lineStart,
        lineEnd === -1 ? undefined : lineEnd
      );
      if (line.includes("baseline:allow-unscoped")) continue;

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
// Test 4: No private env vars in client components
// (baseline.toml can't handle this: Rust regex lacks lookahead for NEXT_PUBLIC_)
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
// Test 7: No @tanstack/react-form in server components
// (baseline.toml can't handle this: file_not_contains only supports one string,
//  but files use both "use client" and 'use client')
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
// (baseline.toml can't handle this: needs brace-depth tracking)
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
// (baseline.toml can't handle this: needs template literal awareness)
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
        if (line.includes("baseline:allow-console")) continue;

        consoleLogRegex.lastIndex = 0;
        if (consoleLogRegex.test(line)) {
          violations.push(`${file}:${i + 1} — console.log() call`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

function getCLICommandFiles(): string[] {
  return findFiles("packages/cli/src/commands/**/*.ts").filter(
    (f) => !(f.includes("__tests__") || f.includes(".test."))
  );
}

// ─────────────────────────────────────────────────────────
// Test 12: No metadata save before deployment completes
// (baseline.toml can't handle this: needs ordering semantics within function)
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
        if (line.includes("baseline:allow-early-save")) continue;

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
// (baseline.toml can't handle this: cross-file uniqueness check)
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
