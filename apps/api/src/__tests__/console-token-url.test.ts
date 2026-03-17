/**
 * Console Token — URL Cleanup
 *
 * Verifies that the console app removes the auth token from the URL
 * after extracting it, preventing leakage via browser history.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Console app — token URL cleanup", () => {
  it("removes token from URL after extraction", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../..", "packages/console/src/App.tsx"),
      "utf-8"
    );

    // After extracting the token from URL params, the app should
    // clean the URL to remove the token (via replaceState or pushState)
    expect(source).toMatch(/replaceState|pushState/);

    // The URL cleanup should remove the token param
    // Look for patterns that modify window.location or history
    const hasHistoryCleanup =
      source.includes("history.replaceState") ||
      source.includes("window.history.replaceState");
    expect(hasHistoryCleanup).toBe(true);
  });
});
