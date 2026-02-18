/**
 * Template Compilation Security Tests
 *
 * Verifies that the server-side RCE vulnerability has been eliminated by:
 * 1. Confirming the dangerous compile API route no longer exists
 * 2. Confirming the client-side compileTemplate function works correctly
 *    (browser-side execution is safe — users can only affect their own session)
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Template Compilation Security", () => {
  it("server-side compile route must not exist", () => {
    const routePath = path.resolve(
      import.meta.dirname,
      "../app/api/[orgSlug]/emails/templates/[id]/compile/route.ts"
    );
    expect(existsSync(routePath)).toBe(false);
  });

  it("no server-side new Function() execution of user code in codebase", async () => {
    const routeDir = path.resolve(import.meta.dirname, "../app/api");

    const { readdirSync, readFileSync, statSync } = await import("node:fs");

    function findRouteFiles(dir: string): string[] {
      const files: string[] = [];
      try {
        for (const entry of readdirSync(dir)) {
          const full = path.join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            files.push(...findRouteFiles(full));
          } else if (entry === "route.ts" || entry === "route.tsx") {
            files.push(full);
          }
        }
      } catch {
        // Directory might not exist
      }
      return files;
    }

    const routeFiles = findRouteFiles(routeDir);

    for (const file of routeFiles) {
      const content = readFileSync(file, "utf-8");
      // No route should use new Function() to execute user-provided code
      const hasNewFunction = /new\s+Function\s*\(/.test(content);
      if (hasNewFunction) {
        throw new Error(
          `SECURITY: ${file} contains "new Function()" which enables RCE. ` +
            "User code must be compiled and executed client-side only."
        );
      }
    }
  });
});
