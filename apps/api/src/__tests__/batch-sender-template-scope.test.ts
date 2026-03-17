/**
 * Batch Sender — Template Org Scope
 *
 * Verifies that the batch sender scopes template lookups by organizationId
 * to prevent cross-org template rendering.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Batch sender — template org scope", () => {
  it("scopes template lookup by organizationId", () => {
    const source = readFileSync(
      resolve(__dirname, "../workers/batch-sender.ts"),
      "utf-8"
    );

    // Find the template query section
    const templateQueryStart = source.indexOf("batch.emailTemplateId");
    expect(templateQueryStart).toBeGreaterThan(-1);

    // Look for the template select query — it should include organizationId
    const afterTemplateId = source.slice(
      templateQueryStart,
      templateQueryStart + 600
    );

    // The template query should scope by organizationId
    // Look for .from(template).where(...organizationId...) pattern
    const fromTemplateIdx = afterTemplateId.indexOf(".from(template)");
    expect(fromTemplateIdx).toBeGreaterThan(-1);

    // Get the next 200 chars after .from(template) — should include organizationId in WHERE
    const afterFrom = afterTemplateId.slice(
      fromTemplateIdx,
      fromTemplateIdx + 300
    );
    expect(afterFrom).toContain("organizationId");
  });
});
