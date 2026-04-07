/**
 * Template Variable Extraction Tests
 *
 * Covers the regex-based variable extractor used by the dashboard's
 * variable mapper UI. Handlebars block helpers like {{else}} must NOT be
 * surfaced as user variables.
 */

import { describe, expect, it, vi } from "vitest";
import { coerceTestDataExport, extractVariables } from "../compile-template";
import { renderForPreview } from "../handlebars";

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

  it("ignores the bare-word Handlebars tokens that the regex matches", () => {
    // `{{#if}}`, `{{/if}}`, `{{#each}}`, `{{/each}}` etc. are skipped by
    // the regex itself (because of `#` and `/`). Only `{{else}}` and
    // `{{this}}` slip through as bare words and need explicit filtering.
    const html = "{{else}} {{this}}";
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

describe("renderForPreview", () => {
  it("substitutes simple variables", () => {
    const html = renderForPreview("Hello {{firstName}}!", {
      firstName: "Jane",
    });
    expect(html).toBe("Hello Jane!");
  });

  it("renders the truthy branch of an {{#if}} conditional", () => {
    const html = renderForPreview(
      "{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup just got easier.",
      { firstName: "Jane" }
    );
    expect(html).toBe("Hey Jane, the setup just got easier.");
  });

  it("renders the {{else}} branch when the variable is missing", () => {
    const html = renderForPreview(
      "{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup just got easier.",
      {}
    );
    expect(html).toBe("The setup just got easier.");
  });

  it("renders the {{else}} branch when the variable is empty string", () => {
    const html = renderForPreview(
      "{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup just got easier.",
      { firstName: "" }
    );
    expect(html).toBe("The setup just got easier.");
  });

  it("escapes HTML in substituted values to prevent XSS in preview", () => {
    const html = renderForPreview("{{firstName}}", {
      firstName: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns the raw html on Handlebars compile failure", () => {
    // Silence the warn so test output stays clean
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // {{#if without matching {{/if}} is a Handlebars syntax error
      const broken = "{{#if firstName}}Hey {{firstName}}";
      expect(renderForPreview(broken, { firstName: "Jane" })).toBe(broken);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("logs a warning when Handlebars compile fails", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const broken = "{{#if firstName}}Hey {{firstName}}";
      renderForPreview(broken, { firstName: "Jane" });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/renderForPreview/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns empty string when given empty html", () => {
    expect(renderForPreview("", { firstName: "Jane" })).toBe("");
  });
});

describe("coerceTestDataExport", () => {
  it("returns a plain object as-is", () => {
    expect(coerceTestDataExport({ firstName: "Jane" })).toEqual({
      firstName: "Jane",
    });
  });

  it("returns an empty object for undefined", () => {
    expect(coerceTestDataExport(undefined)).toEqual({});
  });

  it("returns an empty object for null", () => {
    expect(coerceTestDataExport(null)).toEqual({});
  });

  it("returns an empty object for a string export", () => {
    expect(coerceTestDataExport("not an object")).toEqual({});
  });

  it("returns an empty object for a number export", () => {
    expect(coerceTestDataExport(42)).toEqual({});
  });

  it("returns an empty object for an array export", () => {
    expect(coerceTestDataExport(["a", "b"])).toEqual({});
  });

  it("returns an empty object for a boolean export", () => {
    expect(coerceTestDataExport(true)).toEqual({});
  });
});
