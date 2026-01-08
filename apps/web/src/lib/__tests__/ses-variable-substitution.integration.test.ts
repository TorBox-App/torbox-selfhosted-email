/**
 * SES Variable Substitution Integration Tests
 *
 * These tests verify the complete flow from TipTap content to final
 * rendered email, simulating how SES Handlebars processes templates.
 */

import { render } from "@react-email/render";
import type { JSONContent } from "@tiptap/core";
import { transformVariablesForSes } from "@wraps/email";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import { tiptapToReactEmail } from "../serializers/tiptap-to-react-email";

/**
 * Simulates SES Handlebars template rendering
 * SES uses Handlebars for template substitution
 */
function simulateSesRender(
  template: string,
  data: Record<string, string>
): string {
  const compiled = Handlebars.compile(template);
  return compiled(data);
}

describe("SES Variable Substitution Integration", () => {
  describe("Variable with fallback - contact.firstName missing", () => {
    it("renders fallback when firstName is not provided", async () => {
      // 1. Create template with variable that has fallback
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Welcome back, " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "there",
                },
              },
              { type: "text", text: "! Here's what's new this week." },
            ],
          },
        ],
      };

      // 2. Convert to React Email with placeholders
      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);

      // 3. Transform for SES (this is what gets stored in SES)
      const sesTemplate = transformVariablesForSes(rawHtml);

      // 4. Simulate SES rendering with NO firstName
      const renderedHtml = simulateSesRender(sesTemplate, {
        // firstName is NOT provided - simulating missing contact data
        contactEmail: "user@example.com",
      });

      // 5. Verify fallback is rendered (wrapped in span by React Email)
      expect(renderedHtml).toContain("Welcome back,");
      expect(renderedHtml).toContain(">there<"); // Variable content in span
      // Note: We don't check for "{{" or "}}" absence because CSS nesting syntax uses these
    });

    it("renders actual value when firstName is provided", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Welcome back, " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "there",
                },
              },
              { type: "text", text: "! Here's what's new this week." },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      // Simulate SES rendering WITH firstName
      const renderedHtml = simulateSesRender(sesTemplate, {
        contactFirstName: "John",
        contactEmail: "john@example.com",
      });

      expect(renderedHtml).toContain(">John<"); // Variable content in span
      expect(renderedHtml).not.toContain(">there<");
    });
  });

  describe("Variable without fallback", () => {
    it("renders empty string when value is not provided", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Email: " },
              {
                type: "variable",
                attrs: { name: "contact.email", label: "Email", fallback: "" },
              },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      // When no fallback is set and value is missing, Handlebars renders empty
      const renderedHtml = simulateSesRender(sesTemplate, {});

      expect(renderedHtml).toContain("Email:");
      expect(renderedHtml).not.toContain("{{");
    });

    it("renders value when provided", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Email: " },
              {
                type: "variable",
                attrs: { name: "contact.email", label: "Email", fallback: "" },
              },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      const renderedHtml = simulateSesRender(sesTemplate, {
        contactEmail: "user@example.com",
      });

      expect(renderedHtml).toContain("Email:");
      expect(renderedHtml).toContain(">user@example.com<"); // Variable in span
    });
  });

  describe("Complex template with mixed variables", () => {
    it("correctly renders all variables with appropriate fallbacks", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [
              { type: "text", text: "Hello " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "Friend",
                },
              },
              { type: "text", text: "!" },
            ],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Thanks for being part of " },
              {
                type: "variable",
                attrs: {
                  name: "organization.name",
                  label: "Org",
                  fallback: "our community",
                },
              },
              { type: "text", text: "." },
            ],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Your account email: " },
              {
                type: "variable",
                attrs: { name: "contact.email", label: "Email", fallback: "" },
              },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      // Test with partial data - firstName missing, org name provided
      const renderedHtml = simulateSesRender(sesTemplate, {
        organizationName: "Acme Inc",
        contactEmail: "user@acme.com",
      });

      expect(renderedHtml).toContain(">Friend<"); // fallback in span
      expect(renderedHtml).toContain(">Acme Inc<"); // actual value in span
      expect(renderedHtml).toContain(">user@acme.com<"); // actual value in span
    });

    it("handles all variables missing - uses all fallbacks", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hi " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "there",
                },
              },
              { type: "text", text: ", welcome to " },
              {
                type: "variable",
                attrs: {
                  name: "organization.name",
                  label: "Org",
                  fallback: "our platform",
                },
              },
              { type: "text", text: "!" },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      // No data provided at all
      const renderedHtml = simulateSesRender(sesTemplate, {});

      expect(renderedHtml).toContain(">there<"); // fallback in span
      expect(renderedHtml).toContain(">our platform<"); // fallback in span
    });

    it("handles all variables present - uses all actual values", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hi " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "there",
                },
              },
              { type: "text", text: ", welcome to " },
              {
                type: "variable",
                attrs: {
                  name: "organization.name",
                  label: "Org",
                  fallback: "our platform",
                },
              },
              { type: "text", text: "!" },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      const renderedHtml = simulateSesRender(sesTemplate, {
        contactFirstName: "Jane",
        organizationName: "TechCorp",
      });

      expect(renderedHtml).toContain(">Jane<"); // value in span
      expect(renderedHtml).toContain(">TechCorp<"); // value in span
      expect(renderedHtml).not.toContain(">there<");
      expect(renderedHtml).not.toContain(">our platform<");
    });
  });

  describe("Real-world scenario: batch send replacement data", () => {
    /**
     * This test simulates the actual batch-sender behavior where
     * empty/null values are omitted from the replacement data.
     *
     * See: apps/api/src/workers/batch-sender.ts
     * The addIfPresent helper only adds non-empty values to replacementData.
     */
    it("works with batch-sender style replacement data (omitted empty values)", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Welcome back, " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "valued customer",
                },
              },
              { type: "text", text: "!" },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      // Simulate batch-sender: empty firstName is OMITTED (not included as "")
      // This is key - SES Handlebars {{#if key}} is false when key is missing
      const replacementData: Record<string, string> = {
        contactEmail: "user@example.com",
        // contactFirstName is intentionally NOT included (simulating null/empty)
      };

      const renderedHtml = simulateSesRender(sesTemplate, replacementData);

      // Should use fallback because contactFirstName is missing
      expect(renderedHtml).toContain(">valued customer<"); // fallback in span
      expect(renderedHtml).not.toContain("{{");
    });

    it("uses actual value when batch-sender includes it", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Welcome back, " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "valued customer",
                },
              },
              { type: "text", text: "!" },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: true }
      );
      const rawHtml = await render(component);
      const sesTemplate = transformVariablesForSes(rawHtml);

      // batch-sender includes firstName because contact has one
      const replacementData: Record<string, string> = {
        contactEmail: "john@example.com",
        contactFirstName: "John", // Present because contact.firstName is not empty
      };

      const renderedHtml = simulateSesRender(sesTemplate, replacementData);

      expect(renderedHtml).toContain(">John<"); // value in span
      expect(renderedHtml).not.toContain(">valued customer<");
    });
  });
});

describe("Error handling and edge cases", () => {
  it("handles malformed variable names gracefully", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: { name: "", label: "", fallback: "default" },
            },
          ],
        },
      ],
    };

    const component = tiptapToReactEmail(
      content,
      {},
      { keepVariablesAsPlaceholders: true }
    );
    const rawHtml = await render(component);

    // Should handle empty name gracefully
    expect(rawHtml).toBeDefined();
  });

  it("handles very long fallback values", async () => {
    const longFallback = "A".repeat(200);
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: { name: "test", label: "Test", fallback: longFallback },
            },
          ],
        },
      ],
    };

    const component = tiptapToReactEmail(
      content,
      {},
      { keepVariablesAsPlaceholders: true }
    );
    const rawHtml = await render(component);
    const sesTemplate = transformVariablesForSes(rawHtml);
    const renderedHtml = simulateSesRender(sesTemplate, {});

    expect(renderedHtml).toContain(longFallback);
  });

  it("handles fallback with unicode characters", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: {
                name: "greeting",
                label: "Greeting",
                fallback: "👋 Hello there",
              },
            },
          ],
        },
      ],
    };

    const component = tiptapToReactEmail(
      content,
      {},
      { keepVariablesAsPlaceholders: true }
    );
    const rawHtml = await render(component);
    const sesTemplate = transformVariablesForSes(rawHtml);
    const renderedHtml = simulateSesRender(sesTemplate, {});

    expect(renderedHtml).toContain("👋 Hello there");
  });
});
