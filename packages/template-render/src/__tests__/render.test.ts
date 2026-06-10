/**
 * Canonical template rendering tests.
 *
 * This is the single source of truth for how Wraps renders templates —
 * every call site across the dashboard, API, workers, and CLI eventually
 * delegates to `renderTemplate`, so these tests pin the contract everyone
 * depends on.
 */

import { describe, expect, it } from "vitest";
import { normalizePlainTextForSes } from "../mustache-case";
import {
  compileTemplate,
  nestKeys,
  renderTemplate,
  renderTemplateStrict,
} from "../render";

describe("renderTemplate", () => {
  it("substitutes a simple `{{var}}` placeholder", () => {
    expect(renderTemplate("Hi {{name}}", { name: "Jane" })).toBe("Hi Jane");
  });

  it("evaluates `{{#if}}...{{else}}...{{/if}}` conditionals", () => {
    // This is the exact shape that leaked to inboxes from the send-test route:
    // the dumb regex substituter left the raw Handlebars in the email body.
    const template =
      "{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup just got easier.";

    expect(renderTemplate(template, { firstName: "Jane" })).toBe(
      "Hey Jane, the setup just got easier."
    );
    expect(renderTemplate(template, {})).toBe("The setup just got easier.");
  });

  it("evaluates `{{#each}}` iteration", () => {
    expect(
      renderTemplate("{{#each items}}- {{this}}\n{{/each}}", {
        items: ["one", "two", "three"],
      })
    ).toBe("- one\n- two\n- three\n");
  });

  it("evaluates `{{#unless}}` inverse conditional", () => {
    expect(
      renderTemplate("{{#unless banned}}Welcome{{/unless}}", { banned: false })
    ).toBe("Welcome");
    expect(
      renderTemplate("{{#unless banned}}Welcome{{/unless}}", { banned: true })
    ).toBe("");
  });

  it("evaluates `{{#with}}` context scoping", () => {
    expect(
      renderTemplate("{{#with author}}{{name}}{{/with}}", {
        author: { name: "Jane" },
      })
    ).toBe("Jane");
  });

  it("resolves dot-path variables on nested objects", () => {
    // Workflow sends pass contact data as nested object: {contact: {firstName}}
    expect(
      renderTemplate("Hi {{contact.firstName}}", {
        contact: { firstName: "Jane" },
      })
    ).toBe("Hi Jane");
  });

  it("resolves flat keys that include a literal dot", () => {
    // Dashboard preview callers build flat dicts with dotted keys.
    // Handlebars treats `contact.firstName` as a path lookup, not a flat key.
    // A well-behaved canonical renderer must support either shape — this test
    // documents that flat-dotted-keys are NOT supported directly, because
    // supporting them requires the caller to nest first (see nestKeys helper
    // in apps/web/src/lib/handlebars.ts which is applied BEFORE rendering).
    const input = renderTemplate("{{contact.firstName}}", {
      contact: { firstName: "Nested" },
    });
    expect(input).toBe("Nested");
  });

  it("returns the raw template on compile error instead of throwing", () => {
    // A malformed template must not crash a preview pane or a test-send
    // endpoint — return the raw source so the caller can still render
    // something useful (even if it's the literal Handlebars syntax).
    const malformed = "Hi {{#if name}}{{name}}"; // unclosed block
    expect(() => renderTemplate(malformed, { name: "Jane" })).not.toThrow();
    expect(renderTemplate(malformed, { name: "Jane" })).toBe(malformed);
  });
});

describe("compileTemplate", () => {
  it("returns a reusable function that renders a template against different data", () => {
    // Memoizing callers (broadcast preview carousel) need to compile once and
    // call many times across recipients. compileTemplate gives them that.
    const fn = compileTemplate("Hi {{name}}");
    expect(fn({ name: "Alice" })).toBe("Hi Alice");
    expect(fn({ name: "Bob" })).toBe("Hi Bob");
  });

  it("returns a function that yields the raw html on compile error", () => {
    const malformed = "{{#if foo}}";
    const fn = compileTemplate(malformed);
    expect(() => fn({})).not.toThrow();
    expect(fn({})).toBe(malformed);
  });
});

describe("nestKeys", () => {
  it("converts a flat dict with dotted keys into a nested object", () => {
    // Callers like the subscription mailer build flat dicts:
    //   { "topic.name": "Newsletter", "contact.email": "x@y.com" }
    // Handlebars treats `{{topic.name}}` as a path lookup on `data.topic.name`,
    // so we need to nest the dict before rendering.
    const out = nestKeys({
      "contact.firstName": "Jane",
      "contact.email": "jane@example.com",
      "organization.name": "Acme",
    });
    expect(out.contact).toEqual({
      firstName: "Jane",
      email: "jane@example.com",
    });
    expect(out.organization).toEqual({ name: "Acme" });
  });

  it("preserves the original flat keys alongside the nested form", () => {
    // Templates may reference either `{{contact.firstName}}` (path) or
    // `{{firstName}}` (when the dict was already flat) — supporting both
    // is the whole point of nesting non-destructively.
    const out = nestKeys({ "contact.firstName": "Jane" });
    expect(out["contact.firstName"]).toBe("Jane");
    expect((out.contact as Record<string, unknown>).firstName).toBe("Jane");
  });

  it("returns a flat-only dict unchanged when no dotted keys are present", () => {
    expect(nestKeys({ name: "Jane", email: "j@x.com" })).toEqual({
      name: "Jane",
      email: "j@x.com",
    });
  });

  it("can be composed with renderTemplate to substitute dotted variables", () => {
    // The end-to-end shape every consumer uses.
    const out = renderTemplate(
      "Hi {{contact.firstName}}, welcome to {{organization.name}}.",
      nestKeys({
        "contact.firstName": "Jane",
        "organization.name": "Acme",
      })
    );
    expect(out).toBe("Hi Jane, welcome to Acme.");
  });
});

describe("renderTemplateStrict", () => {
  it("renders exactly like renderTemplate on valid input", () => {
    const tpl =
      "The setup just got easier{{#if firstName}}, {{firstName}}{{/if}}.";
    expect(renderTemplateStrict(tpl, { firstName: "Jane" })).toBe(
      "The setup just got easier, Jane."
    );
    expect(renderTemplateStrict(tpl, {})).toBe("The setup just got easier.");
  });

  it("throws on a malformed template instead of returning the raw string", () => {
    // renderTemplate swallows this and returns the input — acceptable for a
    // preview pane, fatal for a send path. Strict must throw so callers can
    // block the send.
    const malformed = "Hi {{#if firstName}}{{firstName}}";
    expect(() => renderTemplateStrict(malformed, {})).toThrow();
    expect(renderTemplate(malformed, {})).toBe(malformed);
  });

  it("escapes HTML entities by default, not with noEscape", () => {
    const tpl = "Hi {{name}}";
    const data = { name: "O'Brien & Sons" };
    // Default: safe for HTML bodies.
    expect(renderTemplateStrict(tpl, data)).toBe("Hi O&#x27;Brien &amp; Sons");
    // noEscape: required for subjects, SMS, and plain-text parts.
    expect(renderTemplateStrict(tpl, data, { noEscape: true })).toBe(
      "Hi O'Brien & Sons"
    );
  });
});

describe("normalizePlainTextForSes", () => {
  it("restores Handlebars casing destroyed by the heading uppercase in html-to-text", () => {
    // @react-email/render's plainText path uppercases <h1> content, so
    // {{#if firstName}} becomes {{#IF FIRSTNAME}} — SES rejects that as a
    // missing 'IF' attribute at send time (the reengagement-activate-account
    // production failure).
    const html =
      "<h1>{{#if firstName}}Hey {{firstName}}, the{{else}}The{{/if}} setup</h1>";
    const corruptedText =
      "{{#IF FIRSTNAME}}HEY {{FIRSTNAME}}, THE{{ELSE}}THE{{/IF}} SETUP";

    expect(normalizePlainTextForSes(corruptedText, html)).toBe(
      "{{#if firstName}}HEY {{firstName}}, THE{{else}}THE{{/if}} SETUP"
    );
  });

  it("leaves text without uppercased mustaches unchanged", () => {
    const html = "<p>Hi {{firstName}}</p>";
    expect(normalizePlainTextForSes("Hi {{firstName}}", html)).toBe(
      "Hi {{firstName}}"
    );
  });
});
