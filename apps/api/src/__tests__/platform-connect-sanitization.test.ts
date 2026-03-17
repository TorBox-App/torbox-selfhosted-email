/**
 * Platform Connect — Error Sanitization
 *
 * Verifies that error messages sent to telemetry in platform connect
 * use sanitizeErrorMessage to prevent PII leakage (account IDs, ARNs).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Platform connect — telemetry error sanitization", () => {
  it("uses sanitizeErrorMessage for trackError calls", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../../..",
        "packages/cli/src/commands/platform/connect.ts"
      ),
      "utf-8"
    );

    // Find all trackError calls
    const trackErrorCalls = source.match(/trackError\([^)]*\)/g) || [];
    expect(trackErrorCalls.length).toBeGreaterThan(0);

    // Every trackError call that includes a message should use sanitizeErrorMessage
    for (const call of trackErrorCalls) {
      if (call.includes("message")) {
        expect(call).toContain("sanitize");
      }
    }

    // Must import sanitizeErrorMessage
    expect(source).toContain("sanitizeErrorMessage");
  });
});
