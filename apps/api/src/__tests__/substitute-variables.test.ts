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

import { describe, expect, it } from "vitest";

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
});
