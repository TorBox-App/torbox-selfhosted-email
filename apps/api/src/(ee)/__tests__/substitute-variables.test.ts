/**
 * Tests for the substituteVariables function with Handlebars conditional support.
 * This tests the fix for the "Jarodthere" bug where Handlebars conditionals
 * were being incorrectly processed in workflow emails.
 *
 * Bug: Template "Hi {{contact.firstName|there}}" with contact.firstName="Jarod"
 * was rendering as "Hi Jarodthere" instead of "Hi Jarod".
 *
 * Root cause: The workflow processor's substituteVariables function was using
 * a regex that incorrectly processed Handlebars conditional syntax like
 * {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}.
 *
 * Fix: Use Handlebars library to properly evaluate the conditional syntax.
 */

import { transformVariablesForSes } from "@wraps/email";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "../../lib/logger";
import { substituteVariables } from "../workers/workflow-processor";

describe("substituteVariables with Handlebars conditionals", () => {
  describe("Simple variable substitution", () => {
    it("should replace simple variables with values", () => {
      const template = "Hello {{firstName}}!";
      const data = { firstName: "John" };
      expect(substituteVariables(template, data)).toBe("Hello John!");
    });

    it("should handle missing variables (empty string)", () => {
      const template = "Hello {{firstName}}!";
      const data = {};
      expect(substituteVariables(template, data)).toBe("Hello !");
    });
  });

  describe("Handlebars conditional fallbacks (SES-style)", () => {
    it("should use variable value when present", () => {
      // This is the SES-transformed format from transformVariablesForSes
      const template =
        "Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}!";
      const data = { contactFirstName: "Jarod" };
      const result = substituteVariables(template, data);

      expect(result).toBe("Hi Jarod!");
      // Critical: should NOT contain fallback "there" when value is present
      expect(result).not.toContain("there");
    });

    it("should use fallback when variable is missing", () => {
      const template =
        "Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}!";
      const data = {}; // firstName not provided
      const result = substituteVariables(template, data);

      expect(result).toBe("Hi there!");
    });

    it("should use fallback when variable is empty string", () => {
      const template =
        "Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}valued customer{{/if}}!";
      const data = { contactFirstName: "" };
      const result = substituteVariables(template, data);

      expect(result).toBe("Hi valued customer!");
    });

    it("should handle multiple conditionals with mixed presence", () => {
      const template =
        "Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}, " +
        "welcome to {{#if organizationName}}{{organizationName}}{{else}}our platform{{/if}}!";
      const data = {
        contactFirstName: "Jane",
        // organizationName not provided
      };
      const result = substituteVariables(template, data);

      expect(result).toBe("Hi Jane, welcome to our platform!");
    });

    it("should handle all variables present", () => {
      const template =
        "Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}, " +
        "welcome to {{#if organizationName}}{{organizationName}}{{else}}our platform{{/if}}!";
      const data = {
        contactFirstName: "Jane",
        organizationName: "Acme Inc",
      };
      const result = substituteVariables(template, data);

      expect(result).toBe("Hi Jane, welcome to Acme Inc!");
    });

    it("should handle all variables missing (use all fallbacks)", () => {
      const template =
        "Hi {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}, " +
        "welcome to {{#if organizationName}}{{organizationName}}{{else}}our platform{{/if}}!";
      const data = {};
      const result = substituteVariables(template, data);

      expect(result).toBe("Hi there, welcome to our platform!");
    });
  });

  describe("authoring syntax via transformVariablesForSes (the send-path composition)", () => {
    // The step handlers render transformVariablesForSes(template) — never the
    // raw stored template. Raw {{var|fallback}} is a Handlebars parse error,
    // and dotted {{contact.firstName}} can't resolve against flat data; both
    // are exactly what the transform converts. This pins the composition.
    it("renders fallback syntax after transform instead of throwing", () => {
      const stored = "Hello {{firstName|there}}";

      expect(() => substituteVariables(stored, {})).toThrow(
        /Template rendering failed/
      );

      const transformed = transformVariablesForSes(stored);
      expect(substituteVariables(transformed, {})).toBe("Hello there");
      expect(substituteVariables(transformed, { firstName: "Jane" })).toBe(
        "Hello Jane"
      );
    });

    it("resolves dotted paths against flat replacement data after transform", () => {
      const transformed = transformVariablesForSes("Hi {{contact.firstName}}");
      expect(
        substituteVariables(transformed, { contactFirstName: "Jane" })
      ).toBe("Hi Jane");
    });
  });

  describe("HTML escaping", () => {
    it("escapes HTML in variable values when escapeHtml is set (HTML bodies)", () => {
      const template = "Hello {{firstName}}!";
      const data = { firstName: "<script>alert('xss')</script>" };
      const result = substituteVariables(template, data, { escapeHtml: true });

      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("leaves plain text unescaped by default (subjects, SMS bodies)", () => {
      const result = substituteVariables("Hi {{company}}", {
        company: "O'Brien & Sons",
      });
      expect(result).toBe("Hi O'Brien & Sons");
    });
  });

  describe("Real-world scenario: SES-compiled template", () => {
    it("should correctly process a full SES-style compiled HTML", () => {
      // Simulating what compiledHtml looks like after transformVariablesForSes
      const compiledHtml = `
        <html>
          <body>
            <h1>Welcome back, <span data-variable="contact.firstName">{{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}</span>!</h1>
            <p>Here's what's new this week at <span data-variable="organization.name">{{#if organizationName}}{{organizationName}}{{else}}our platform{{/if}}</span>.</p>
          </body>
        </html>
      `;

      // Case 1: Contact has firstName
      const resultWithName = substituteVariables(compiledHtml, {
        contactFirstName: "Jarod",
        organizationName: "Wraps",
      });
      expect(resultWithName).toContain(">Jarod<");
      expect(resultWithName).toContain(">Wraps<");
      expect(resultWithName).not.toContain(">there<");
      expect(resultWithName).not.toContain(">Jarodthere<"); // The bug we're fixing!

      // Case 2: Contact without firstName (should use fallback)
      const resultWithoutName = substituteVariables(compiledHtml, {
        contactEmail: "user@example.com",
        // contactFirstName not provided
      });
      expect(resultWithoutName).toContain(">there<");
      expect(resultWithoutName).toContain(">our platform<");
    });
  });

  describe("Render failure blocks the send", () => {
    // Why this exists: the renderer used to swallow compile errors and
    // return the raw template string, and the worker only logged a warning —
    // so malformed templates shipped literal `{{#if firstName}}` subject
    // lines to real recipients (Apr–Jun 2026, 22 recipients). The contract is
    // now: a render failure THROWS, failing the workflow step, so the send is
    // blocked and the execution surfaces a retryable error instead.
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(log, "error").mockImplementation(() => {
        // intentionally silent in tests
      });
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("throws when the template fails to compile", () => {
      // Unclosed {{#if}} block — Handlebars compile throws.
      const malformed = "Hi {{#if firstName}}{{firstName}}";

      expect(() =>
        substituteVariables(malformed, { firstName: "Jane" })
      ).toThrow(/Template rendering failed/);
      // The worker logs the failure so on-call can find the broken template.
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("never returns input containing unconsumed block markers", () => {
      const malformed = "Hi {{#if firstName}}{{firstName}}";

      let result: string | undefined;
      try {
        result = substituteVariables(malformed, {});
      } catch {
        // expected
      }
      // Whatever happens, raw {{#if must not be handed to a send path.
      expect(result?.includes("{{#if")).not.toBe(true);
    });

    it("does not throw or log on a successful render", () => {
      const result = substituteVariables("Hi {{firstName}}", {
        firstName: "Jane",
      });

      expect(result).toBe("Hi Jane");
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("does not throw when a well-formed template references a missing variable", () => {
      // Missing variables resolve to empty string — that's normal Handlebars
      // behavior, not a render failure. Throwing is reserved for actual
      // compile/runtime failures so retries aren't burned on false positives.
      const result = substituteVariables("Hi {{firstName}}!", {});

      expect(result).toBe("Hi !");
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
