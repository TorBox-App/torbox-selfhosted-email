/**
 * SES Variable Transformation Tests
 *
 * Tests for transforming template variables to SES-compatible format.
 */

import { describe, expect, it } from "vitest";
import {
  flattenVariablesForSes,
  toSesVariableName,
  transformVariablesForSes,
} from "../ses-variables";

describe("toSesVariableName", () => {
  it("leaves simple names unchanged", () => {
    expect(toSesVariableName("firstName")).toBe("firstName");
    expect(toSesVariableName("email")).toBe("email");
    expect(toSesVariableName("unsubscribeUrl")).toBe("unsubscribeUrl");
  });

  it("converts dot notation to camelCase", () => {
    expect(toSesVariableName("contact.email")).toBe("contactEmail");
    expect(toSesVariableName("contact.firstName")).toBe("contactFirstName");
    expect(toSesVariableName("organization.name")).toBe("organizationName");
  });

  it("handles deeply nested paths", () => {
    expect(toSesVariableName("contact.properties.customField")).toBe(
      "contactPropertiesCustomField"
    );
    expect(toSesVariableName("a.b.c.d")).toBe("aBCD");
  });

  it("handles underscore paths", () => {
    expect(toSesVariableName("contact.first_name")).toBe("contactFirst_name");
  });
});

describe("transformVariablesForSes", () => {
  describe("simple variable syntax", () => {
    it("transforms simple variable names", () => {
      const input = "Hello {{firstName}}!";
      const output = transformVariablesForSes(input);
      expect(output).toBe("Hello {{firstName}}!");
    });

    it("transforms dot notation variables", () => {
      const input = "Hello {{contact.firstName}}!";
      const output = transformVariablesForSes(input);
      expect(output).toBe("Hello {{contactFirstName}}!");
    });

    it("handles multiple variables", () => {
      const input = "Hi {{contact.firstName}} {{contact.lastName}}!";
      const output = transformVariablesForSes(input);
      expect(output).toBe("Hi {{contactFirstName}} {{contactLastName}}!");
    });

    it("handles whitespace around variable names", () => {
      const input = "Hello {{ contact.firstName }}!";
      const output = transformVariablesForSes(input);
      expect(output).toBe("Hello {{contactFirstName}}!");
    });

    it("preserves non-variable content", () => {
      const input = "<p>Hello world! This is a test.</p>";
      const output = transformVariablesForSes(input);
      expect(output).toBe("<p>Hello world! This is a test.</p>");
    });

    it("handles complex HTML with variables", () => {
      const input = `
        <div class="container">
          <h1>Hello {{contact.firstName}}!</h1>
          <p>Your email is {{contact.email}}</p>
          <a href="{{unsubscribeUrl}}">Unsubscribe</a>
        </div>
      `;
      const output = transformVariablesForSes(input);
      expect(output).toContain("{{contactFirstName}}");
      expect(output).toContain("{{contactEmail}}");
      expect(output).toContain("{{unsubscribeUrl}}");
      expect(output).not.toContain("contact.firstName");
    });
  });

  describe("fallback syntax", () => {
    it("transforms variable with fallback to Handlebars conditional", () => {
      const input = "Hi {{firstName|there}}!";
      const output = transformVariablesForSes(input);
      expect(output).toBe(
        "Hi {{#if firstName}}{{firstName}}{{else}}there{{/if}}!"
      );
    });

    it("transforms dot notation with fallback", () => {
      const input = "Hello {{contact.firstName|friend}}!";
      const output = transformVariablesForSes(input);
      expect(output).toBe(
        "Hello {{#if contactFirstName}}{{contactFirstName}}{{else}}friend{{/if}}!"
      );
    });

    it("handles whitespace in fallback value", () => {
      const input = "{{greeting| dear customer }}";
      const output = transformVariablesForSes(input);
      expect(output).toBe(
        "{{#if greeting}}{{greeting}}{{else}}dear customer{{/if}}"
      );
    });

    it("handles empty fallback value", () => {
      const input = "{{firstName|}}";
      const output = transformVariablesForSes(input);
      expect(output).toBe("{{#if firstName}}{{firstName}}{{else}}{{/if}}");
    });

    it("handles multiple variables with and without fallbacks", () => {
      const input =
        "Hi {{firstName|there}}, your email is {{contact.email}}";
      const output = transformVariablesForSes(input);
      expect(output).toBe(
        "Hi {{#if firstName}}{{firstName}}{{else}}there{{/if}}, your email is {{contactEmail}}"
      );
    });

    it("handles complex template with mixed variables", () => {
      const input = `
        <p>Hello {{contact.firstName|valued customer}},</p>
        <p>Thank you for your order!</p>
        <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
      `;
      const output = transformVariablesForSes(input);
      expect(output).toContain(
        "{{#if contactFirstName}}{{contactFirstName}}{{else}}valued customer{{/if}}"
      );
      expect(output).toContain("{{unsubscribeUrl}}");
    });
  });

  describe("edge cases", () => {
    it("handles empty string input", () => {
      expect(transformVariablesForSes("")).toBe("");
    });

    it("handles string with no variables", () => {
      const input = "Hello world! This has no variables.";
      expect(transformVariablesForSes(input)).toBe(input);
    });

    it("does not transform invalid variable patterns", () => {
      // Missing closing braces
      const input1 = "Hello {{firstName!";
      expect(transformVariablesForSes(input1)).toBe("Hello {{firstName!");

      // Missing opening braces
      const input2 = "Hello firstName}}!";
      expect(transformVariablesForSes(input2)).toBe("Hello firstName}}!");
    });

    it("handles URL-encoded content correctly", () => {
      const input =
        '<a href="https://example.com?name={{contact.firstName}}">Link</a>';
      const output = transformVariablesForSes(input);
      expect(output).toBe(
        '<a href="https://example.com?name={{contactFirstName}}">Link</a>'
      );
    });

    it("handles JSON-like content", () => {
      const input = '{"name": "{{contact.firstName}}"}';
      const output = transformVariablesForSes(input);
      expect(output).toBe('{"name": "{{contactFirstName}}"}');
    });
  });
});

describe("flattenVariablesForSes", () => {
  it("flattens simple object", () => {
    const input = {
      firstName: "John",
      lastName: "Doe",
    };
    const output = flattenVariablesForSes(input);
    expect(output).toEqual({
      firstName: "John",
      lastName: "Doe",
    });
  });

  it("flattens nested object with camelCase keys", () => {
    const input = {
      contact: {
        email: "john@example.com",
        firstName: "John",
      },
      unsubscribeUrl: "https://example.com/unsub",
    };
    const output = flattenVariablesForSes(input);
    expect(output).toEqual({
      contactEmail: "john@example.com",
      contactFirstName: "John",
      unsubscribeUrl: "https://example.com/unsub",
    });
  });

  it("converts non-string values to strings", () => {
    const input = {
      count: 42,
      active: true,
      nullable: null,
    };
    const output = flattenVariablesForSes(input);
    expect(output).toEqual({
      count: "42",
      active: "true",
      nullable: "",
    });
  });

  it("handles deeply nested objects", () => {
    const input = {
      contact: {
        properties: {
          customField: "value",
        },
      },
    };
    const output = flattenVariablesForSes(input);
    expect(output).toEqual({
      contactPropertiesCustomField: "value",
    });
  });

  it("handles empty objects", () => {
    expect(flattenVariablesForSes({})).toEqual({});
  });

  it("handles complex mixed data", () => {
    const input = {
      contact: {
        email: "test@example.com",
        firstName: "Jane",
        lastName: "Smith",
      },
      organization: {
        name: "Acme Inc",
      },
      unsubscribeUrl: "https://example.com/unsub/token",
      preferencesUrl: "https://example.com/prefs/token",
    };
    const output = flattenVariablesForSes(input);
    expect(output).toEqual({
      contactEmail: "test@example.com",
      contactFirstName: "Jane",
      contactLastName: "Smith",
      organizationName: "Acme Inc",
      unsubscribeUrl: "https://example.com/unsub/token",
      preferencesUrl: "https://example.com/prefs/token",
    });
  });
});
