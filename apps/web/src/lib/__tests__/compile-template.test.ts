/**
 * Template Variable Extraction Tests
 *
 * Covers the regex-based variable extractor used by the dashboard's
 * variable mapper UI. Handlebars block helpers like {{else}} must NOT be
 * surfaced as user variables.
 */

import { describe, expect, it } from "vitest";
import { extractVariables } from "../compile-template";

describe("extractVariables", () => {
  it("extracts a simple variable", () => {
    const vars = extractVariables("Hello {{firstName}}!");
    expect(vars).toEqual([{ name: "firstName", fallback: undefined }]);
  });

  it("extracts variables with fallbacks", () => {
    const vars = extractVariables("Hi {{firstName|there}}");
    expect(vars).toEqual([{ name: "firstName", fallback: "there" }]);
  });

  it("deduplicates repeated variables", () => {
    const vars = extractVariables("{{name}} and {{name}} again");
    expect(vars).toEqual([{ name: "name", fallback: undefined }]);
  });

  it("does NOT treat {{else}} from a Handlebars conditional as a variable", () => {
    const html =
      "{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup just got easier.";
    const vars = extractVariables(html);
    const names = vars.map((v) => v.name);
    expect(names).toContain("firstName");
    expect(names).not.toContain("else");
  });

  it("ignores all common Handlebars block keywords", () => {
    // {{#if}}, {{/if}}, {{#each}}, {{/each}} are skipped by the regex itself
    // (because of `#` and `/`); the bare keywords are skipped by the keyword set.
    const html = "{{else}} {{this}} {{if}} {{unless}} {{each}} {{with}}";
    const vars = extractVariables(html);
    expect(vars).toHaveLength(0);
  });

  it("preserves real variables that share a name with a non-keyword word", () => {
    // 'name' is not a keyword
    const vars = extractVariables("{{name}}");
    expect(vars.map((v) => v.name)).toEqual(["name"]);
  });

  it("handles dotted variable names", () => {
    const vars = extractVariables("{{contact.email}}");
    expect(vars.map((v) => v.name)).toEqual(["contact.email"]);
  });
});
