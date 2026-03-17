/**
 * Schema — awsAccountPermission unique constraint
 *
 * Verifies that the (userId, awsAccountId) index on awsAccountPermission
 * is a uniqueIndex, not a regular index, preventing duplicate permission rows.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("awsAccountPermission schema — unique constraint", () => {
  it("uses uniqueIndex for (userId, awsAccountId) combination", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../..", "packages/db/src/schema/app.ts"),
      "utf-8"
    );

    // Find the awsAccountPermission table definition
    const tableMatch = source.match(
      /awsAccountPermission\s*=\s*pgTable\([\s\S]*?^\)/m
    );
    expect(tableMatch).not.toBeNull();

    const tableDef = tableMatch![0];

    // The unique_idx line must use uniqueIndex, not index
    expect(tableDef).toContain("uniqueIndex");
    // Should NOT have a regular `index(` for the user+account combination
    const uniqueIdxLine = tableDef.match(
      /uniqueUserAccount:\s*(uniqueIndex|index)/
    );
    expect(uniqueIdxLine).not.toBeNull();
    expect(uniqueIdxLine![1]).toBe("uniqueIndex");
  });
});
