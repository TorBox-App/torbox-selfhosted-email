/**
 * Shared Handlebars Helper Tests
 *
 * The renderForPreview behaviour is covered in compile-template.test.ts
 * (it's re-exported from there). This file pins the keyword set so any
 * future change has to go through code review — those keywords are used
 * as a defensive filter in extractTemplateVariables to keep stale
 * `template.variables` jsonb rows from leaking `{{else}}` etc. into the
 * broadcast variable mapper UI.
 */

import { describe, expect, it } from "vitest";
import { HANDLEBARS_KEYWORDS } from "../handlebars";

describe("HANDLEBARS_KEYWORDS", () => {
  it("contains the Handlebars block-helper keyword `else`", () => {
    // The literal regression: `{{else}}` was surfacing in the variable
    // mapper as a user variable to map. Stale rows with name === "else"
    // must be filtered.
    expect(HANDLEBARS_KEYWORDS.has("else")).toBe(true);
  });

  it("contains the other common Handlebars block keywords", () => {
    for (const keyword of ["if", "unless", "each", "with", "this"]) {
      expect(HANDLEBARS_KEYWORDS.has(keyword)).toBe(true);
    }
  });

  it("does not accidentally filter common user variable names", () => {
    for (const userVar of ["firstName", "email", "name", "company"]) {
      expect(HANDLEBARS_KEYWORDS.has(userVar)).toBe(false);
    }
  });

  it("filters a stored variables array as expected", () => {
    // Mirrors the defensive filter in extractTemplateVariables
    const stored = [
      { name: "firstName" },
      { name: "else" },
      { name: "unsubscribeUrl" },
      { name: "this" },
    ];
    const filtered = stored.filter((v) => !HANDLEBARS_KEYWORDS.has(v.name));
    expect(filtered.map((v) => v.name)).toEqual([
      "firstName",
      "unsubscribeUrl",
    ]);
  });
});
