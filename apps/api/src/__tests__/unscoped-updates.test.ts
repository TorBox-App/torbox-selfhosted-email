/**
 * Unscoped UPDATE/DELETE — Defense in Depth
 *
 * Verifies that UPDATE/DELETE queries in critical handlers include
 * organizationId scoping, even when IDs were already validated.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routesDir = resolve(__dirname, "..");

describe("Defense-in-depth: org-scoped updates", () => {
  it("batch cancel UPDATE scopes by organizationId", () => {
    const source = readFileSync(resolve(routesDir, "routes/batch.ts"), "utf-8");

    // Find the cancel section and verify organizationId is in the WHERE
    const cancelIdx = source.indexOf('"cancelled"');
    expect(cancelIdx).toBeGreaterThan(-1);

    // Get code between "cancelled" and the next return statement
    const afterCancel = source.slice(cancelIdx, cancelIdx + 500);
    expect(afterCancel).toContain(".organizationId");
  });

  it("contact PATCH UPDATE scopes by organizationId", () => {
    const source = readFileSync(
      resolve(routesDir, "routes/contacts.ts"),
      "utf-8"
    );

    // Find .set(updateValues) and verify organizationId is between it and .returning()
    const setIdx = source.indexOf(".set(updateValues)");
    expect(setIdx).toBeGreaterThan(-1);

    const returningIdx = source.indexOf(".returning()", setIdx);
    expect(returningIdx).toBeGreaterThan(setIdx);

    const betweenSetAndReturning = source.slice(setIdx, returningIdx);
    expect(betweenSetAndReturning).toContain("organizationId");
  });

  it("unsubscribe global UPDATE scopes contact by organizationId", () => {
    const source = readFileSync(
      resolve(routesDir, "routes/unsubscribe.ts"),
      "utf-8"
    );

    // Find the global unsubscribe section: update(contact).set({emailStatus: "unsubscribed"})
    // and verify organizationId appears in the WHERE between that and the next comment/statement
    const unsubIdx = source.indexOf('emailStatus: "unsubscribed"');
    expect(unsubIdx).toBeGreaterThan(-1);

    // Get 300 chars after the emailStatus assignment
    const afterUnsub = source.slice(unsubIdx, unsubIdx + 400);
    expect(afterUnsub).toContain("organizationId");
  });
});
