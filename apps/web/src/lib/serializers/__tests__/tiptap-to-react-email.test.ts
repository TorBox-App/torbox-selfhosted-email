/**
 * TipTap to React Email Serializer Tests
 *
 * Tests for converting TipTap JSON content to React Email components,
 * with special focus on variable substitution and fallback handling.
 */

import { render } from "@react-email/render";
import type { JSONContent } from "@tiptap/core";
import { transformVariablesForSes } from "@wraps/email";
import { describe, expect, it } from "vitest";
import {
  generateReactEmailCode,
  tiptapToReactEmail,
} from "../tiptap-to-react-email";

describe("tiptapToReactEmail - Variable Handling", () => {
  describe("resolveVariable with keepVariablesAsPlaceholders=true", () => {
    it("renders variable without fallback as {{name}}", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "",
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
      const html = await render(component);

      expect(html).toContain("{{contact.firstName}}");
      expect(html).not.toContain("|");
    });

    it("renders variable with fallback as {{name|fallback}}", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello " },
              {
                type: "variable",
                attrs: {
                  name: "contact.firstName",
                  label: "First Name",
                  fallback: "there",
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
      const html = await render(component);

      expect(html).toContain("{{contact.firstName|there}}");
    });

    it("preserves fallback with special characters", async () => {
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
                  fallback: "dear customer",
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
      const html = await render(component);

      expect(html).toContain("{{greeting|dear customer}}");
    });

    it("handles multiple variables with mixed fallback usage", async () => {
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
              { type: "text", text: ", your email is " },
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
      const html = await render(component);

      expect(html).toContain("{{contact.firstName|there}}");
      expect(html).toContain("{{contact.email}}");
      expect(html).not.toContain("{{contact.email|}}");
    });
  });

  describe("resolveVariable with keepVariablesAsPlaceholders=false (preview mode)", () => {
    it("uses test data value when available", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello " },
              {
                type: "variable",
                attrs: {
                  name: "firstName",
                  label: "First Name",
                  fallback: "there",
                },
              },
              { type: "text", text: "!" },
            ],
          },
        ],
      };

      const testData = { firstName: "John" };
      const component = tiptapToReactEmail(content, testData, {
        keepVariablesAsPlaceholders: false,
      });
      const html = await render(component);

      expect(html).toContain("John");
      expect(html).not.toContain("{{");
      expect(html).not.toContain("there");
    });

    it("uses fallback when test data is missing", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello " },
              {
                type: "variable",
                attrs: {
                  name: "firstName",
                  label: "First Name",
                  fallback: "there",
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
        { keepVariablesAsPlaceholders: false }
      );
      const html = await render(component);

      expect(html).toContain("there");
      expect(html).not.toContain("{{");
    });

    it("shows placeholder when no fallback and no data", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "variable",
                attrs: { name: "firstName", label: "First Name", fallback: "" },
              },
            ],
          },
        ],
      };

      const component = tiptapToReactEmail(
        content,
        {},
        { keepVariablesAsPlaceholders: false }
      );
      const html = await render(component);

      expect(html).toContain("{{firstName}}");
    });
  });
});

describe("End-to-end: TipTap to SES Template Flow", () => {
  it("produces correct SES Handlebars conditional for variable with fallback", async () => {
    // 1. Create TipTap content with a variable that has a fallback
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
                fallback: "friend",
              },
            },
            { type: "text", text: "! Here's what's new." },
          ],
        },
      ],
    };

    // 2. Convert to React Email with placeholders preserved
    const component = tiptapToReactEmail(
      content,
      {},
      { keepVariablesAsPlaceholders: true }
    );
    const rawHtml = await render(component);

    // 3. Verify the raw HTML contains the fallback syntax
    expect(rawHtml).toContain("{{contact.firstName|friend}}");

    // 4. Transform for SES
    const sesHtml = transformVariablesForSes(rawHtml);

    // 5. Verify the SES template has proper Handlebars conditional
    expect(sesHtml).toContain(
      "{{#if contactFirstName}}{{contactFirstName}}{{else}}friend{{/if}}"
    );
    expect(sesHtml).not.toContain("{{contact.firstName}}");
    expect(sesHtml).not.toContain("{{contact.firstName|friend}}");
  });

  it("produces simple variable syntax when no fallback is provided", async () => {
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
    const sesHtml = transformVariablesForSes(rawHtml);

    // Should be simple variable, not conditional
    expect(sesHtml).toContain("{{contactEmail}}");
    expect(sesHtml).not.toContain("{{#if");
    expect(sesHtml).not.toContain("{{else}}");
  });

  it("handles complex template with multiple variables", async () => {
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
            { type: "text", text: "," },
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
                label: "Org Name",
                fallback: "our community",
              },
            },
            { type: "text", text: "!" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Contact: " },
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
    const sesHtml = transformVariablesForSes(rawHtml);

    // Variables with fallbacks should have conditionals
    expect(sesHtml).toContain(
      "{{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}"
    );
    expect(sesHtml).toContain(
      "{{#if organizationName}}{{organizationName}}{{else}}our community{{/if}}"
    );

    // Variable without fallback should be simple
    expect(sesHtml).toContain("{{contactEmail}}");
  });

  it("handles variable in button text", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailButton",
          attrs: {
            href: "https://example.com",
            backgroundColor: "#5046e5",
            color: "#ffffff",
          },
          content: [
            { type: "text", text: "Hello " },
            {
              type: "variable",
              attrs: {
                name: "contact.firstName",
                label: "First Name",
                fallback: "there",
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
    const sesHtml = transformVariablesForSes(rawHtml);

    expect(sesHtml).toContain(
      "{{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}"
    );
  });

  it("handles variable in heading", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            { type: "text", text: "Welcome, " },
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
      ],
    };

    const component = tiptapToReactEmail(
      content,
      {},
      { keepVariablesAsPlaceholders: true }
    );
    const rawHtml = await render(component);
    const sesHtml = transformVariablesForSes(rawHtml);

    expect(sesHtml).toContain(
      "{{#if contactFirstName}}{{contactFirstName}}{{else}}Friend{{/if}}"
    );
  });
});

describe("Edge Cases", () => {
  it("handles empty fallback string", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: { name: "firstName", label: "First Name", fallback: "" },
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
    const html = await render(component);

    // Empty fallback should NOT include the pipe
    expect(html).toContain("{{firstName}}");
    expect(html).not.toContain("{{firstName|}}");
  });

  it("handles fallback with HTML-like characters", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: { name: "name", label: "Name", fallback: "<User>" },
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

    // The fallback should be preserved (might be HTML-encoded)
    expect(rawHtml).toMatch(/\{\{name\|.*User.*\}\}/);
  });

  it("handles deeply nested variable names", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: {
                name: "contact.properties.customField",
                label: "Custom",
                fallback: "N/A",
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
    const sesHtml = transformVariablesForSes(rawHtml);

    expect(sesHtml).toContain(
      "{{#if contactPropertiesCustomField}}{{contactPropertiesCustomField}}{{else}}N/A{{/if}}"
    );
  });

  it("handles variable with undefined attrs gracefully", async () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: { name: "test" },
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
    const html = await render(component);

    expect(html).toContain("{{test}}");
  });
});

describe("generateReactEmailCode - Variable Output", () => {
  it("generates correct props reference for variables", () => {
    const content: JSONContent = {
      type: "variable",
      attrs: { name: "firstName", label: "First Name", fallback: "there" },
    };

    const code = generateReactEmailCode(content);
    expect(code).toContain("props.firstName");
  });
});
