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

import Handlebars from "handlebars";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HANDLEBARS_KEYWORDS, nestKeys, renderForPreview } from "../handlebars";

describe("HANDLEBARS_KEYWORDS", () => {
  it("contains the Handlebars block-helper keyword `else`", () => {
    // The literal regression: `{{else}}` was surfacing in the variable
    // mapper as a user variable to map. Stale rows with name === "else"
    // must be filtered.
    expect(HANDLEBARS_KEYWORDS.has("else")).toBe(true);
  });

  it("contains `this` (the other bare-word that slips through)", () => {
    // `{{this}}` matches the regex but is a Handlebars context reference,
    // not a user variable.
    expect(HANDLEBARS_KEYWORDS.has("this")).toBe(true);
  });

  it("does NOT include block helpers like `if`, `unless`, `each`, `with`", () => {
    // These can never appear bare in the regex output because the regex
    // already skips `{{#X}}` (because of `#`) and `{{/X}}` (because of `/`).
    // Including them in the filter set would be misleading and over-broad.
    for (const blockHelper of [
      "if",
      "unless",
      "each",
      "with",
      "lookup",
      "log",
    ]) {
      expect(HANDLEBARS_KEYWORDS.has(blockHelper)).toBe(false);
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

describe("nestKeys", () => {
  it("returns a flat object unchanged when no dotted keys are present", () => {
    const out = nestKeys({ firstName: "Jane", email: "j@example.com" });
    expect(out).toEqual({ firstName: "Jane", email: "j@example.com" });
  });

  it("converts dotted keys into a nested object", () => {
    const out = nestKeys({ "contact.firstName": "Jane" });
    expect(out.contact).toEqual({ firstName: "Jane" });
  });

  it("preserves the original dotted key alongside the nested form", () => {
    // Templates may use either style; both should resolve.
    const out = nestKeys({ "contact.firstName": "Jane" });
    expect(out["contact.firstName"]).toBe("Jane");
    expect((out.contact as Record<string, unknown>).firstName).toBe("Jane");
  });

  it("merges multiple keys under the same nested object", () => {
    const out = nestKeys({
      "contact.firstName": "Jane",
      "contact.lastName": "Doe",
      "contact.email": "j@example.com",
    });
    expect(out.contact).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      email: "j@example.com",
    });
  });

  it("handles deeply nested paths", () => {
    const out = nestKeys({ "a.b.c": "deep" });
    expect(
      ((out.a as Record<string, unknown>).b as Record<string, unknown>).c
    ).toBe("deep");
  });

  it("does not crash when a flat key collides with a nested namespace", () => {
    // If a caller passes both `contact` and `contact.firstName`, we keep
    // the dotted-derived nested object and the flat alias coexists.
    const out = nestKeys({
      contact: "raw",
      "contact.firstName": "Jane",
    });
    expect(out["contact.firstName"]).toBe("Jane");
    // The nested form wins for the bare `contact` key — that's acceptable
    // because templates referencing `{{contact}}` directly (not `{{contact.X}}`)
    // are unusual and our caller doesn't generate that shape.
    expect((out.contact as Record<string, unknown>).firstName).toBe("Jane");
  });

  it("returns an empty object for an empty input", () => {
    expect(nestKeys({})).toEqual({});
  });
});

describe("renderForPreview memoization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("only compiles a given html string once across multiple calls", () => {
    const compileSpy = vi.spyOn(Handlebars, "compile");
    const html = `unique-template-${Date.now()}-${Math.random()} {{name}}`;

    renderForPreview(html, { name: "Alice" });
    renderForPreview(html, { name: "Bob" });
    renderForPreview(html, { name: "Carol" });

    expect(compileSpy).toHaveBeenCalledTimes(1);
  });

  it("recompiles for distinct html strings", () => {
    const compileSpy = vi.spyOn(Handlebars, "compile");
    const tag = `${Date.now()}-${Math.random()}`;

    renderForPreview(`a-${tag} {{x}}`, { x: "1" });
    renderForPreview(`b-${tag} {{x}}`, { x: "2" });

    expect(compileSpy).toHaveBeenCalledTimes(2);
  });

  it("returns the substituted output from the cached template", () => {
    // Cached lookups must not return stale rendered output — the cache
    // should hold the compiled function, not the rendered string.
    const html = `cache-${Date.now()}-${Math.random()} Hello {{name}}`;
    expect(renderForPreview(html, { name: "Alice" })).toContain("Hello Alice");
    expect(renderForPreview(html, { name: "Bob" })).toContain("Hello Bob");
  });
});
