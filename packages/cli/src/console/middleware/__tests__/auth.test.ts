/**
 * Console Auth Middleware — Timing-Safe Comparison
 *
 * Verifies that token comparison uses timingSafeEqual instead of ===
 * to prevent timing oracle attacks on session tokens.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Console auth middleware — timing-safe comparison", () => {
  it("uses timingSafeEqual instead of === for token comparison", () => {
    const source = readFileSync(resolve(__dirname, "../auth.ts"), "utf-8");

    // Must import or use timingSafeEqual
    expect(source).toContain("timingSafeEqual");

    // Must NOT use direct equality for token comparison
    // Look for patterns like `token !== expectedToken` or `token === expectedToken`
    const directComparisonPattern = /token\s*[!=]==?\s*expectedToken/;
    expect(source).not.toMatch(directComparisonPattern);
  });
});
