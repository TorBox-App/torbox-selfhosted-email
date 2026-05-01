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
  it("batch cancel UPDATE scopes by organizationId in the WHERE clause", () => {
    // Cancel logic lives in the repository — check there
    const source = readFileSync(
      resolve(routesDir, "../../../packages/db/src/repositories/broadcasts.ts"),
      "utf-8"
    );

    const fnIdx = source.indexOf("export async function cancelBroadcast");
    expect(fnIdx).toBeGreaterThan(-1);

    // Find the .where( call within this function and verify organizationId
    // appears inside it — not just anywhere in the function body (e.g. a parameter name)
    const fnBody = source.slice(fnIdx, fnIdx + 600);
    const whereStart = fnBody.indexOf(".where(");
    expect(whereStart).toBeGreaterThan(-1);

    // Find the matching closing paren for .where(
    let depth = 0;
    let whereEnd = whereStart + ".where(".length;
    for (; whereEnd < fnBody.length; whereEnd++) {
      if (fnBody[whereEnd] === "(") depth++;
      else if (fnBody[whereEnd] === ")") {
        if (depth === 0) {
          whereEnd++;
          break;
        }
        depth--;
      }
    }

    const whereClause = fnBody.slice(whereStart, whereEnd);
    expect(whereClause).toContain("organizationId");
    // Also verify the status value is in the .set() — search the full body for that
    expect(fnBody).toContain('"cancelled"');
  });

  it("contact PATCH UPDATE scopes by organizationId in the WHERE clause", () => {
    // The update logic lives in the repository — check there
    const source = readFileSync(
      resolve(routesDir, "../../../packages/db/src/repositories/contacts.ts"),
      "utf-8"
    );

    const fnIdx = source.indexOf("export async function updateContactFields");
    expect(fnIdx).toBeGreaterThan(-1);

    const fnBody = source.slice(fnIdx, fnIdx + 600);

    // Verify organizationId is in the .where() clause, not just the parameter list
    const whereStart = fnBody.indexOf(".where(");
    expect(whereStart).toBeGreaterThan(-1);

    let depth = 0;
    let whereEnd = whereStart + ".where(".length;
    for (; whereEnd < fnBody.length; whereEnd++) {
      if (fnBody[whereEnd] === "(") depth++;
      else if (fnBody[whereEnd] === ")") {
        if (depth === 0) {
          whereEnd++;
          break;
        }
        depth--;
      }
    }

    const whereClause = fnBody.slice(whereStart, whereEnd);
    expect(whereClause).toContain("organizationId");
    expect(fnBody).toContain(".returning()");
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
