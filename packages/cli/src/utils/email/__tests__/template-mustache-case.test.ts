/**
 * Template Plain-Text Mustache Case Normalization
 *
 * @react-email/render({ plainText: true }) uppercases `<Heading>` content
 * via html-to-text's default h1 behavior. When a template puts Handlebars
 * syntax inside a heading, `{{#if firstName}}` becomes `{{#IF FIRSTNAME}}`
 * in the plain-text output. SES Handlebars is case-sensitive — it does not
 * recognize `#IF` as the `if` block helper and reports:
 *
 *   "Attribute 'IF' is not present in the rendering data."
 *
 * `normalizePlainTextMustaches` restores the original casing of known
 * Handlebars keywords (if/unless/each/with/else) and known template
 * variables so SES can parse the plain-text version correctly.
 */

import { describe, expect, it } from "vitest";
import { normalizePlainTextMustaches } from "../template-mustache-case";

describe("normalizePlainTextMustaches", () => {
  it("lowercases an uppercased `{{#IF}}` block open", () => {
    const out = normalizePlainTextMustaches("{{#IF}}", new Set());
    expect(out).toBe("{{#if}}");
  });

  it("lowercases `{{/IF}}` block close and `{{ELSE}}` chain marker", () => {
    const out = normalizePlainTextMustaches(
      "a{{/IF}}b{{ELSE}}c{{/UNLESS}}d{{#EACH}}e{{#WITH}}f",
      new Set()
    );
    expect(out).toBe("a{{/if}}b{{else}}c{{/unless}}d{{#each}}e{{#with}}f");
  });

  it("restores variable case from the canonical variable set", () => {
    // html-to-text uppercased `{{firstName}}` to `{{FIRSTNAME}}`. The
    // canonical set (tracked by the proxy during HTML render) tells us
    // the original camelCase spelling to restore.
    const out = normalizePlainTextMustaches(
      "Hey {{FIRSTNAME}}, welcome to {{COMPANYNAME}}!",
      new Set(["firstName", "companyName"])
    );
    expect(out).toBe("Hey {{firstName}}, welcome to {{companyName}}!");
  });

  it("restores block helper + argument together", () => {
    // This is the exact pattern from the failing reengagement template:
    // `{{#IF FIRSTNAME}}Hey {{FIRSTNAME}}, the{{ELSE}}The{{/IF}}` needs
    // to become the original `{{#if firstName}}...{{else}}...{{/if}}`.
    const out = normalizePlainTextMustaches(
      "{{#IF FIRSTNAME}}Hey {{FIRSTNAME}}, the{{ELSE}}The{{/IF}} setup just got easier.",
      new Set(["firstName"])
    );
    expect(out).toBe(
      "{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup just got easier."
    );
  });

  it("leaves already-correct mustaches untouched", () => {
    const input =
      "{{#if firstName}}Hey {{firstName}}{{else}}Hey there{{/if}}, welcome.";
    expect(normalizePlainTextMustaches(input, new Set(["firstName"]))).toBe(
      input
    );
  });

  it("leaves unknown uppercase tokens untouched (not a known helper or variable)", () => {
    // `SKU_123` is not a Handlebars helper and not in the canonical set —
    // we have no safe way to rewrite it, so it stays as-is. Better to
    // leave one stray token than mangle a real identifier.
    const input = "Order {{SKU_123}} processed.";
    expect(normalizePlainTextMustaches(input, new Set(["firstName"]))).toBe(
      input
    );
  });
});
