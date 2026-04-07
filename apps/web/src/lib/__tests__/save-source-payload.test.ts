/**
 * Save-Source Payload Builder Tests
 *
 * Both `handleSave` (in code-template-code-view.tsx) and `handleAIApply`
 * (in code-template-editor.tsx) POST to /save-source. Before this helper,
 * they constructed the body inline and the AI path forgot to forward
 * `variables` and `testData`, silently wiping them on every AI apply.
 *
 * This helper centralizes the body shape so the bug can't recur.
 */

import { describe, expect, it } from "vitest";
import { buildSaveSourcePayload } from "../save-source-payload";

const fixture = {
  compiledHtml: "<html><body>Hi {{firstName}}</body></html>",
  compiledText: "Hi {{firstName}}",
  variables: [{ name: "firstName" }],
  subject: "Hi {{firstName}}",
  emailType: "marketing",
  previewText: "Welcome",
  testData: { firstName: "Jane" } as Record<string, unknown>,
};

describe("buildSaveSourcePayload", () => {
  it("forwards source, compiledHtml, compiledText, variables, and testData", () => {
    const payload = buildSaveSourcePayload("source.tsx contents", fixture);
    expect(payload).toEqual({
      source: "source.tsx contents",
      compiledHtml: fixture.compiledHtml,
      compiledText: fixture.compiledText,
      variables: fixture.variables,
      testData: fixture.testData,
    });
  });

  it("preserves a non-empty variables array", () => {
    const compiled = {
      ...fixture,
      variables: [{ name: "firstName" }, { name: "lastName" }],
    };
    const payload = buildSaveSourcePayload("src", compiled);
    expect(payload.variables).toHaveLength(2);
    expect(payload.variables).toEqual([
      { name: "firstName" },
      { name: "lastName" },
    ]);
  });

  it("preserves a non-empty testData object", () => {
    const compiled = {
      ...fixture,
      testData: { firstName: "Jane", company: "Acme" },
    };
    const payload = buildSaveSourcePayload("src", compiled);
    expect(payload.testData).toEqual({ firstName: "Jane", company: "Acme" });
  });

  it("handles empty variables and testData without dropping the keys", () => {
    const compiled = { ...fixture, variables: [], testData: {} };
    const payload = buildSaveSourcePayload("src", compiled);
    expect(payload.variables).toEqual([]);
    expect(payload.testData).toEqual({});
  });
});
