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

  describe("HTML escaping", () => {
    it("should escape HTML in variable values", () => {
      const template = "Hello {{firstName}}!";
      const data = { firstName: "<script>alert('xss')</script>" };
      const result = substituteVariables(template, data);

      // Handlebars escapes HTML by default
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
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

  describe("Render failure observability", () => {
    // Why this exists: the previous regex-fallback implementation logged a
    // warning when Handlebars threw. The consolidation onto
    // @wraps/template-render dropped that log because the renderer swallows
    // errors and returns the raw template string. Without observability, a
    // malformed template silently ships raw `{{#if}}` to a paying customer's
    // recipients on the workflow send path. This regression test asserts the
    // worker still emits a warning when the renderer bails so on-call can
    // detect and remediate.
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {
        // intentionally silent in tests
      });
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("logs a warning when the template fails to compile", () => {
      // Unclosed {{#if}} block — Handlebars compile throws.
      const malformed = "Hi {{#if firstName}}{{firstName}}";

      const result = substituteVariables(malformed, { firstName: "Jane" });

      // Renderer falls back to raw template — that's the contract.
      expect(result).toBe(malformed);
      // The worker MUST log a warning so we can detect this in production.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [msg] = warnSpy.mock.calls[0];
      expect(String(msg).toLowerCase()).toMatch(/template|render|substitute/);
    });

    it("does not log on a successful render", () => {
      const result = substituteVariables("Hi {{firstName}}", {
        firstName: "Jane",
      });

      expect(result).toBe("Hi Jane");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not log when a well-formed template references a missing variable", () => {
      // Missing variables resolve to empty string — that's normal Handlebars
      // behavior, not a render failure. The warning is reserved for actual
      // compile/runtime failures so on-call doesn't drown in false positives.
      const result = substituteVariables("Hi {{firstName}}!", {});

      expect(result).toBe("Hi !");
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
