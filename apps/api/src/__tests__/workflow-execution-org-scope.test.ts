/**
 * cancelExecutionsForTopicUnsubscribe — Org Scope
 *
 * Verifies that the workflowExecution query in cancelExecutionsForTopicUnsubscribe
 * includes organizationId scoping for defense-in-depth.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cancelExecutionsForTopicUnsubscribe — org scope", () => {
  it("scopes workflowExecution query by organizationId", () => {
    const source = readFileSync(
      resolve(__dirname, "../services/workflow-events.ts"),
      "utf-8"
    );

    // Find the cancelExecutionsForTopicUnsubscribe function
    const fnStart = source.indexOf(
      "async function cancelExecutionsForTopicUnsubscribe"
    );
    expect(fnStart).toBeGreaterThan(-1);

    // Find the workflowExecution query within the function
    const fnBody = source.slice(fnStart, fnStart + 2000);
    const executionQuery = fnBody.indexOf("workflowExecution");
    expect(executionQuery).toBeGreaterThan(-1);

    // The query should include organizationId scoping
    // Look for organizationId between the workflowExecution select and the next major operation
    const querySection = fnBody.slice(
      executionQuery,
      fnBody.indexOf("if (activeExecutions")
    );
    expect(querySection).toContain("organizationId");
  });
});
