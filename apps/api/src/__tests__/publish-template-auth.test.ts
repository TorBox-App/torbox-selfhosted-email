/**
 * publishTemplateToSES — Auth Gate
 *
 * Verifies that the exported server action checks verifyOrgAccess
 * before performing any AWS operations.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("publishTemplateToSES — auth gate", () => {
  it("calls verifyOrgAccess before any AWS operations", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../..", "apps/web/src/actions/templates.ts"),
      "utf-8"
    );

    // Find the publishTemplateToSES function
    const fnMatch = source.match(
      /export async function publishTemplateToSES\b[\s\S]*?^}/m
    );
    expect(fnMatch).not.toBeNull();

    const fnBody = fnMatch![0];

    // Must call verifyOrgAccess
    expect(fnBody).toContain("verifyOrgAccess");

    // verifyOrgAccess must appear BEFORE getOrAssumeRole / db.query
    const verifyIndex = fnBody.indexOf("verifyOrgAccess");
    const assumeRoleIndex = fnBody.indexOf("getOrAssumeRole");
    const dbQueryIndex = fnBody.indexOf("db.query");

    // verifyOrgAccess must come before AWS operations
    if (assumeRoleIndex > -1) {
      expect(verifyIndex).toBeLessThan(assumeRoleIndex);
    }
    if (dbQueryIndex > -1) {
      expect(verifyIndex).toBeLessThan(dbQueryIndex);
    }
  });
});
