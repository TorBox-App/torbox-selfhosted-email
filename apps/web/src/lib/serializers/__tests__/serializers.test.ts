import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { parseHTMLToTipTap } from "../html-to-tiptap";
import { parseReactEmailToTipTap } from "../react-email-to-tiptap";
import {
  extractWrapperConfig,
  generateReactEmailCode,
  renderTipTapToHtml,
  tiptapToReactEmail,
} from "../tiptap-to-react-email";

/**
 * Comprehensive tests for TipTap serialization/deserialization
 *
 * Tests cover:
 * 1. HTML → TipTap conversion
 * 2. React Email → TipTap conversion (with Tailwind classes)
 * 3. Round-trip conversions
 */

describe("HTML to TipTap Conversion", () => {
  describe("Basic Elements", () => {
    it("should parse headings", () => {
      const html = "<h1>Hello World</h1>";
      const result = parseHTMLToTipTap(html);

      expect(result.type).toBe("doc");
      expect(result.content).toHaveLength(1);
      expect(result.content?.[0]).toMatchObject({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Hello World" }],
      });
    });

    it("should parse all heading levels", () => {
      const html = `
        <h1>H1</h1>
        <h2>H2</h2>
        <h3>H3</h3>
        <h4>H4</h4>
        <h5>H5</h5>
        <h6>H6</h6>
      `;
      const result = parseHTMLToTipTap(html);

      expect(result.content).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(result.content?.[i]).toMatchObject({
          type: "heading",
          attrs: { level: i + 1 },
        });
      }
    });

    it("should parse paragraphs", () => {
      const html = "<p>This is a paragraph.</p>";
      const result = parseHTMLToTipTap(html);

      expect(result.content).toHaveLength(1);
      expect(result.content?.[0]).toMatchObject({
        type: "paragraph",
        content: [{ type: "text", text: "This is a paragraph." }],
      });
    });

    it("should parse divs as paragraphs", () => {
      const html = "<div>Content in a div</div>";
      const result = parseHTMLToTipTap(html);

      expect(result.content).toHaveLength(1);
      expect(result.content?.[0].type).toBe("paragraph");
    });
  });

  describe("Inline Formatting", () => {
    it("should parse bold text", () => {
      const html = "<p><strong>Bold text</strong></p>";
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0].content).toContainEqual({
        type: "text",
        text: "Bold text",
        marks: [{ type: "bold" }],
      });
    });

    it("should parse italic text", () => {
      const html = "<p><em>Italic text</em></p>";
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0].content).toContainEqual({
        type: "text",
        text: "Italic text",
        marks: [{ type: "italic" }],
      });
    });

    it("should parse links", () => {
      const html = '<p><a href="https://example.com">Click here</a></p>';
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0].content).toContainEqual({
        type: "text",
        text: "Click here",
        marks: [{ type: "link", attrs: { href: "https://example.com" } }],
      });
    });
  });

  describe("Images", () => {
    it("should parse images", () => {
      const html =
        '<img src="https://example.com/image.png" alt="Test image" width="300" height="200" />';
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0]).toMatchObject({
        type: "emailImage",
        attrs: {
          src: "https://example.com/image.png",
          alt: "Test image",
          width: "300",
          height: "200",
        },
      });
    });
  });

  describe("Lists", () => {
    it("should parse bullet lists", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0]).toMatchObject({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Item 1" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Item 2" }],
              },
            ],
          },
        ],
      });
    });

    it("should parse ordered lists", () => {
      const html = "<ol><li>First</li><li>Second</li></ol>";
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0]).toMatchObject({
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "First" }] },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Second" }],
              },
            ],
          },
        ],
      });
    });
  });

  describe("Dividers", () => {
    it("should parse horizontal rules", () => {
      const html = "<hr />";
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0]).toMatchObject({
        type: "emailDivider",
        attrs: {
          color: "#e5e7eb",
          thickness: "1px",
          margin: "24px",
        },
      });
    });
  });

  describe("Buttons", () => {
    it("should parse styled links as buttons", () => {
      const html =
        '<a href="https://example.com" style="background-color: #3b82f6; color: white; padding: 10px 20px;">Click me</a>';
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0]).toMatchObject({
        type: "emailButton",
        attrs: {
          href: "https://example.com",
          backgroundColor: "#3b82f6",
        },
      });
    });
  });

  describe("Sections", () => {
    it("should parse semantic sections", () => {
      const html =
        '<section style="background-color: #f0f0f0; padding: 16px;"><p>Content</p></section>';
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0]).toMatchObject({
        type: "emailSection",
        attrs: {
          backgroundColor: "#f0f0f0",
          padding: "16px",
        },
      });
    });
  });
});

describe("React Email to TipTap Conversion", () => {
  describe("Basic Components", () => {
    it("should parse Text component", () => {
      const code = `
        import { Text } from "@react-email/components";
        export default function Email() {
          return <Text>Hello World</Text>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.type).toBe("doc");
      expect(result.content?.[0]).toMatchObject({
        type: "paragraph",
        content: [{ type: "text", text: "Hello World" }],
      });
    });

    it("should parse Heading component", () => {
      const code = `
        import { Heading } from "@react-email/components";
        export default function Email() {
          return <Heading as="h1">Title</Heading>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Title" }],
      });
    });

    it("should parse Heading with different levels", () => {
      const code = `
        import { Heading } from "@react-email/components";
        export default function Email() {
          return (
            <>
              <Heading as="h1">H1</Heading>
              <Heading as="h2">H2</Heading>
              <Heading as="h3">H3</Heading>
            </>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "heading",
        attrs: { level: 1 },
      });
      expect(result.content?.[1]).toMatchObject({
        type: "heading",
        attrs: { level: 2 },
      });
      expect(result.content?.[2]).toMatchObject({
        type: "heading",
        attrs: { level: 3 },
      });
    });
  });

  describe("Button Component", () => {
    it("should parse Button with href", () => {
      const code = `
        import { Button } from "@react-email/components";
        export default function Email() {
          return <Button href="https://example.com">Click me</Button>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailButton",
        attrs: {
          href: "https://example.com",
        },
        content: [{ type: "text", text: "Click me" }],
      });
    });

    it("should parse Button with Tailwind classes", () => {
      const code = `
        import { Button } from "@react-email/components";
        export default function Email() {
          return (
            <Button
              href="https://example.com"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Click me
            </Button>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailButton",
        attrs: {
          href: "https://example.com",
          backgroundColor: "#2563eb", // blue-600
          color: "#ffffff", // white
          borderRadius: "8px", // rounded-lg
          fontWeight: "600", // font-semibold
        },
        content: [{ type: "text", text: "Click me" }],
      });
    });

    it("should parse Button wrapped in div for alignment", () => {
      const code = `
        import { Button } from "@react-email/components";
        export default function Email() {
          return (
            <div className="text-center">
              <Button href="#">Centered Button</Button>
            </div>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      // The div should be unwrapped and the button should be directly in the doc
      expect(result.content?.[0]).toMatchObject({
        type: "emailButton",
        content: [{ type: "text", text: "Centered Button" }],
      });
    });
  });

  describe("Image Component", () => {
    it("should parse Img component", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="https://example.com/image.png" alt="Logo" width="200" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailImage",
        attrs: {
          src: "https://example.com/image.png",
          alt: "Logo",
          width: "200",
        },
      });
    });

    it("should parse Img with Tailwind width", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="https://example.com/image.png" className="max-w-[600px]" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailImage",
        attrs: {
          src: "https://example.com/image.png",
          width: "600px", // max-w-[600px] should be parsed when no explicit width
        },
      });
    });

    it("should prefer width over max-width for Img", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="https://example.com/image.png" className="w-full max-w-[600px]" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      // w-full (100%) takes priority over max-w-[600px]
      expect(result.content?.[0]).toMatchObject({
        type: "emailImage",
        attrs: {
          src: "https://example.com/image.png",
          width: "100%",
        },
      });
    });
  });

  describe("Section Component", () => {
    it("should parse Section component", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email() {
          return (
            <Section className="bg-gray-100 p-6 rounded-lg">
              <Text>Content</Text>
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailSection",
        attrs: {
          backgroundColor: "#f3f4f6", // gray-100
          padding: "24px", // p-6 = 24px
          borderRadius: "8px", // rounded-lg
        },
      });
    });
  });

  describe("Hr Component", () => {
    it("should parse Hr component", () => {
      const code = `
        import { Hr } from "@react-email/components";
        export default function Email() {
          return <Hr className="border-gray-200 my-6" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailDivider",
      });
    });
  });

  describe("Link Component", () => {
    it("should parse Link component", () => {
      const code = `
        import { Link } from "@react-email/components";
        export default function Email() {
          return <Link href="https://example.com">Click here</Link>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Click here",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      });
    });
  });

  describe("Container Components", () => {
    it("should unwrap Html, Body, Container", () => {
      const code = `
        import { Html, Body, Container, Text } from "@react-email/components";
        export default function Email() {
          return (
            <Html>
              <Body>
                <Container>
                  <Text>Hello</Text>
                </Container>
              </Body>
            </Html>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      // Should have the Text content, not the containers
      expect(result.content?.[0]).toMatchObject({
        type: "paragraph",
        content: [{ type: "text", text: "Hello" }],
      });
    });

    it("should unwrap Tailwind component", () => {
      const code = `
        import { Html, Tailwind, Text } from "@react-email/components";
        export default function Email() {
          return (
            <Html>
              <Tailwind>
                <Text>Content</Text>
              </Tailwind>
            </Html>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "paragraph",
        content: [{ type: "text", text: "Content" }],
      });
    });
  });

  describe("Tailwind Class Parsing", () => {
    it("should parse background colors", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="bg-indigo-600"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailSection",
        attrs: {
          backgroundColor: "#4f46e5", // indigo-600
        },
      });
    });

    it("should parse padding classes", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="p-8"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailSection",
        attrs: {
          padding: "32px", // p-8 = 8 * 4 = 32px
        },
      });
    });

    it("should parse border radius classes", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="rounded-xl"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailSection",
        attrs: {
          borderRadius: "12px", // rounded-xl
        },
      });
    });

    it("should parse text colors", () => {
      const code = `
        import { Button } from "@react-email/components";
        export default function Email() {
          return <Button href="#" className="text-red-500">Red Button</Button>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailButton",
        attrs: {
          color: "#ef4444", // red-500
        },
      });
    });

    it("should parse font weight classes", () => {
      const code = `
        import { Button } from "@react-email/components";
        export default function Email() {
          return <Button href="#" className="font-bold">Bold Button</Button>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.content?.[0]).toMatchObject({
        type: "emailButton",
        attrs: {
          fontWeight: "700", // font-bold
        },
      });
    });
  });

  describe("Variables", () => {
    it("should parse variable expressions", () => {
      const code = `
        import { Text } from "@react-email/components";
        export default function Email({ name }) {
          return <Text>Hello {name}</Text>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      // Should contain text and a variable node
      const content = result.content?.[0].content;
      expect(content).toContainEqual({ type: "text", text: "Hello" });
      expect(content).toContainEqual({
        type: "variable",
        attrs: {
          name: "name",
          label: "name",
          fallback: "",
          format: null,
        },
      });
    });
  });

  describe("Complex Templates", () => {
    it("should parse a complete email template", () => {
      const code = `
        import { Html, Head, Body, Container, Section, Heading, Text, Button, Hr, Img, Tailwind } from "@react-email/components";

        export default function WelcomeEmail({ userName }) {
          return (
            <Html>
              <Tailwind>
                <Head />
                <Body className="bg-gray-100 font-sans">
                  <Container className="bg-white mx-auto p-5 max-w-[600px]">
                    <Heading as="h1" className="text-2xl font-bold">Welcome!</Heading>
                    <Text>Hello {userName}, welcome to our platform.</Text>
                    <Hr className="my-4" />
                    <div className="text-center">
                      <Button href="https://example.com" className="bg-blue-600 text-white px-6 py-3 rounded-md">
                        Get Started
                      </Button>
                    </div>
                    <Img src="https://example.com/logo.png" alt="Logo" className="w-[200px]" />
                  </Container>
                </Body>
              </Tailwind>
            </Html>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.type).toBe("doc");
      expect(result.content?.length).toBeGreaterThan(0);

      // Should have heading
      expect(result.content?.some((node) => node.type === "heading")).toBe(
        true
      );

      // Should have paragraph with variable
      const textNode = result.content?.find(
        (node) => node.type === "paragraph"
      );
      expect(textNode?.content?.some((c) => c.type === "variable")).toBe(true);

      // Should have button
      const buttonNode = result.content?.find(
        (node) => node.type === "emailButton"
      );
      expect(buttonNode).toBeDefined();
      expect(buttonNode?.attrs?.href).toBe("https://example.com");

      // Should have image
      const imageNode = result.content?.find(
        (node) => node.type === "emailImage"
      );
      expect(imageNode).toBeDefined();
      expect(imageNode?.attrs?.src).toBe("https://example.com/logo.png");

      // Should have divider
      expect(result.content?.some((node) => node.type === "emailDivider")).toBe(
        true
      );
    });
  });
});

describe("Round-trip Conversion", () => {
  describe("HTML round-trip", () => {
    it("should preserve heading structure", () => {
      const originalHtml = "<h1>Title</h1><h2>Subtitle</h2>";
      const tiptap = parseHTMLToTipTap(originalHtml);

      expect(tiptap.content).toHaveLength(2);
      expect(tiptap.content?.[0]).toMatchObject({
        type: "heading",
        attrs: { level: 1 },
      });
      expect(tiptap.content?.[1]).toMatchObject({
        type: "heading",
        attrs: { level: 2 },
      });
    });

    it("should preserve list structure", () => {
      const originalHtml = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const tiptap = parseHTMLToTipTap(originalHtml);

      expect(tiptap.content?.[0]).toMatchObject({
        type: "bulletList",
        content: expect.arrayContaining([
          expect.objectContaining({ type: "listItem" }),
          expect.objectContaining({ type: "listItem" }),
        ]),
      });
    });
  });

  describe("React Email structure preservation", () => {
    it("should preserve button attributes through conversion", () => {
      const code = `
        import { Button } from "@react-email/components";
        export default function Email() {
          return (
            <Button
              href="https://test.com"
              className="bg-green-600 text-white rounded-full"
            >
              Test Button
            </Button>
          );
        }
      `;
      const tiptap = parseReactEmailToTipTap(code);

      const button = tiptap.content?.find(
        (node) => node.type === "emailButton"
      );
      expect(button).toBeDefined();
      expect(button?.attrs?.href).toBe("https://test.com");
      expect(button?.attrs?.backgroundColor).toBe("#16a34a"); // green-600
      expect(button?.attrs?.borderRadius).toBe("9999px"); // rounded-full
      expect(button?.content).toContainEqual({
        type: "text",
        text: "Test Button",
      });
    });

    it("should preserve section styling through conversion", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email() {
          return (
            <Section className="bg-purple-100 p-6 rounded-lg">
              <Text>Section content</Text>
            </Section>
          );
        }
      `;
      const tiptap = parseReactEmailToTipTap(code);

      const section = tiptap.content?.find(
        (node) => node.type === "emailSection"
      );
      expect(section).toBeDefined();
      expect(section?.attrs?.backgroundColor).toBe("#f3e8ff"); // purple-100
      expect(section?.attrs?.padding).toBe("24px"); // p-6
      expect(section?.attrs?.borderRadius).toBe("8px"); // rounded-lg
    });

    it("should preserve image attributes through conversion", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="https://example.com/photo.jpg" alt="Photo" className="w-full h-[300px]" />;
        }
      `;
      const tiptap = parseReactEmailToTipTap(code);

      const image = tiptap.content?.find((node) => node.type === "emailImage");
      expect(image).toBeDefined();
      expect(image?.attrs?.src).toBe("https://example.com/photo.jpg");
      expect(image?.attrs?.alt).toBe("Photo");
      expect(image?.attrs?.width).toBe("100%");
      expect(image?.attrs?.height).toBe("300px");
    });
  });
});

describe("Edge Cases", () => {
  describe("HTML edge cases", () => {
    it("should handle empty content", () => {
      const html = "";
      const result = parseHTMLToTipTap(html);

      expect(result.type).toBe("doc");
      expect(result.content?.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle whitespace-only content", () => {
      const html = "   \n\t  ";
      const result = parseHTMLToTipTap(html);

      expect(result.type).toBe("doc");
    });

    it("should handle nested inline elements", () => {
      const html = "<p><strong><em>Bold and italic</em></strong></p>";
      const result = parseHTMLToTipTap(html);

      expect(result.content?.[0].type).toBe("paragraph");
    });

    it("should handle script and style tags (skip them)", () => {
      const html =
        '<script>alert("test")</script><style>body{}</style><p>Content</p>';
      const result = parseHTMLToTipTap(html);

      // Should only have the paragraph, not script/style
      expect(result.content).toHaveLength(1);
      expect(result.content?.[0].type).toBe("paragraph");
    });
  });

  describe("React Email edge cases", () => {
    it("should handle empty components", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      expect(result.type).toBe("doc");
      const section = result.content?.find(
        (node) => node.type === "emailSection"
      );
      expect(section).toBeDefined();
      // Should have default content
      expect(section?.content).toBeDefined();
    });

    it("should throw on invalid JSX so callers can handle the error", () => {
      const code = "not valid jsx";
      expect(() => parseReactEmailToTipTap(code)).toThrow();
    });

    it("should handle Preview component (skip it)", () => {
      const code = `
        import { Preview, Text } from "@react-email/components";
        export default function Email() {
          return (
            <>
              <Preview>Preview text</Preview>
              <Text>Actual content</Text>
            </>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      // Should only have the Text content, not Preview
      expect(result.content?.some((node) => node.type === "preview")).toBe(
        false
      );
      expect(result.content?.some((node) => node.type === "paragraph")).toBe(
        true
      );
    });

    it("should handle arbitrary Tailwind values", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="p-[20px] w-[500px]"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);

      const section = result.content?.find(
        (node) => node.type === "emailSection"
      );
      expect(section?.attrs?.padding).toBe("20px");
    });
  });

  describe("Block/Inline separation", () => {
    it("should not nest block elements in paragraphs", () => {
      const code = `
        import { Container, Button, Text } from "@react-email/components";
        export default function Email() {
          return (
            <Container>
              <Text>Some text</Text>
              <Button href="#">Click</Button>
              <Text>More text</Text>
            </Container>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      // All content should be at the top level, not nested in paragraphs
      result.content?.forEach((node) => {
        if (node.type === "emailButton") {
          // Button should be a direct child, not inside a paragraph
          expect(true).toBe(true);
        }
      });

      // Specifically check that buttons are not inside paragraphs
      const paragraphs =
        result.content?.filter((node) => node.type === "paragraph") || [];
      for (const para of paragraphs) {
        const hasButtonChild = para.content?.some(
          (child) => child.type === "emailButton"
        );
        expect(hasButtonChild).toBeFalsy();
      }
    });
  });
});

describe("TipTap to React Email Conversion", () => {
  describe("Basic Document Structure", () => {
    it("should generate valid React Email template", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello World" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain(
        'import { Html, Head, Body, Container, Text, Button, Section, Row, Column, Img, Hr, Heading, Link, Preview, Tailwind, pixelBasedPreset } from "@react-email/components"'
      );
      expect(result).toContain("export default function EmailTemplate()");
      expect(result).toContain("<Html>");
      expect(result).toContain(
        "<Tailwind config={{ presets: [pixelBasedPreset] }}>"
      );
      expect(result).toContain("Hello World");
    });

    it("should generate Text component for paragraphs", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Test paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("<Text");
      expect(result).toContain("Test paragraph");
    });

    it("should generate Heading component with correct level", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "My Heading" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain('<Heading as="h2"');
      expect(result).toContain("My Heading");
    });
  });

  describe("Button Styling Preservation", () => {
    it("should preserve button background color", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "https://example.com",
              backgroundColor: "#dc2626", // red-600
              color: "#ffffff",
              borderRadius: "8px",
              padding: "12px 24px",
              fontWeight: "600",
              align: "center",
            },
            content: [{ type: "text", text: "Click Me" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      // Uses bracket syntax for colors and border radius for better email compatibility
      expect(result).toContain("bg-[#dc2626]");
      expect(result).toContain("text-white");
      expect(result).toContain("rounded-[8px]");
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain("Click Me");
    });

    it("should preserve custom button colors using arbitrary values", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "#",
              backgroundColor: "#ff5500", // Custom color
              color: "#333333",
              borderRadius: "4px",
              padding: "16px 32px",
              fontWeight: "700",
              align: "left",
            },
            content: [{ type: "text", text: "Custom Button" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("bg-[#ff5500]");
      expect(result).toContain("text-[#333333]");
    });

    it("should handle button alignment", () => {
      const centerButton: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: { href: "#", align: "center" },
            content: [{ type: "text", text: "Center" }],
          },
        ],
      };
      const rightButton: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: { href: "#", align: "right" },
            content: [{ type: "text", text: "Right" }],
          },
        ],
      };

      expect(generateReactEmailCode(centerButton)).toContain(
        'className="text-center"'
      );
      expect(generateReactEmailCode(rightButton)).toContain(
        'className="text-right"'
      );
    });
  });

  describe("Section Styling Preservation", () => {
    it("should preserve section background and padding", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSection",
            attrs: {
              backgroundColor: "#f3e8ff", // purple-100
              padding: "32px",
              borderRadius: "12px",
            },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Section content" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      // Uses bracket syntax for colors, padding, and border radius for better email compatibility
      expect(result).toContain("bg-[#f3e8ff]");
      expect(result).toContain("p-[32px]");
      expect(result).toContain("rounded-[12px]");
    });

    it("should use arbitrary values for custom padding", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSection",
            attrs: {
              backgroundColor: "#ffffff",
              padding: "17px", // Non-standard
              borderRadius: "0",
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("p-[17px]");
    });
  });

  describe("Image Attributes Preservation", () => {
    it("should preserve image src and alt", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailImage",
            attrs: {
              src: "https://example.com/image.png",
              alt: "Example Image",
              width: "300px",
              height: "200px",
              align: "center",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain('src="https://example.com/image.png"');
      expect(result).toContain('alt="Example Image"');
      expect(result).toContain("w-[300px]");
      expect(result).toContain("h-[200px]");
    });

    it("should handle full width images", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailImage",
            attrs: {
              src: "https://example.com/banner.png",
              alt: "Banner",
              width: "100%",
              height: "auto",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("w-full");
      expect(result).toContain("h-auto");
    });
  });

  describe("Divider and Spacer", () => {
    it("should generate Hr for dividers", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailDivider",
            attrs: {
              borderColor: "#e5e7eb",
              margin: "24px",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("<Hr");
      expect(result).toContain("border-gray-200");
      expect(result).toContain("my-6");
    });

    it("should generate spacer divs", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSpacer",
            attrs: { height: "48px" },
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("h-[48px]");
    });
  });

  describe("Lists", () => {
    it("should generate bullet lists", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 1" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 2" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("<ul");
      expect(result).toContain("<li");
      expect(result).toContain("Item 1");
      expect(result).toContain("Item 2");
    });

    it("should generate ordered lists", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("<ol");
      expect(result).toContain("First");
    });
  });

  describe("Variables", () => {
    it("should generate variable expressions", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello " },
              { type: "variable", attrs: { name: "userName" } },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("{props.userName}");
    });
  });

  describe("Rows and Columns", () => {
    it("should generate row with columns", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailRow",
            attrs: { gap: "16px" },
            content: [
              {
                type: "emailColumn",
                attrs: { width: "50%" },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Left" }],
                  },
                ],
              },
              {
                type: "emailColumn",
                attrs: { width: "50%" },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Right" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);

      expect(result).toContain("<Row>");
      expect(result).toContain("<Column>");
      expect(result).toContain("Left");
      expect(result).toContain("Right");
    });
  });
});

describe("Full Round-Trip Tests", () => {
  it("should preserve button styles through full round-trip", () => {
    // Create TipTap doc
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailButton",
          attrs: {
            href: "https://test.com",
            backgroundColor: "#16a34a", // green-600
            color: "#ffffff",
            borderRadius: "9999px",
            padding: "12px 24px",
            fontWeight: "600",
            align: "center",
          },
          content: [{ type: "text", text: "Green Button" }],
        },
      ],
    };

    // Generate React Email code
    const reactEmailCode = generateReactEmailCode(originalDoc);

    // Parse back to TipTap
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    // Verify button was preserved
    const button = parsedDoc.content?.find(
      (node) => node.type === "emailButton"
    );
    expect(button).toBeDefined();
    expect(button?.attrs?.backgroundColor).toBe("#16a34a");
    expect(button?.attrs?.borderRadius).toBe("9999px");
    expect(button?.content).toContainEqual({
      type: "text",
      text: "Green Button",
    });
  });

  it("should preserve section styles through full round-trip", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSection",
          attrs: {
            backgroundColor: "#f3e8ff", // purple-100
            padding: "32px",
            borderRadius: "8px",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section text" }],
            },
          ],
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    const section = parsedDoc.content?.find(
      (node) => node.type === "emailSection"
    );
    expect(section).toBeDefined();
    expect(section?.attrs?.backgroundColor).toBe("#f3e8ff");
    expect(section?.attrs?.padding).toBe("32px");
    expect(section?.attrs?.borderRadius).toBe("8px");
  });

  it("should preserve preview text through full round-trip", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailPreview",
          attrs: {
            text: "Check out our latest updates!",
          },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Email body" }],
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    const preview = parsedDoc.content?.find(
      (node) => node.type === "emailPreview"
    );
    expect(preview).toBeDefined();
    expect(preview?.attrs?.text).toBe("Check out our latest updates!");
  });

  it("should preserve image attributes through full round-trip", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailImage",
          attrs: {
            src: "https://example.com/hero.jpg",
            alt: "Hero image",
            width: "600px",
            height: "300px",
            align: "center",
          },
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    const image = parsedDoc.content?.find((node) => node.type === "emailImage");
    expect(image).toBeDefined();
    expect(image?.attrs?.src).toBe("https://example.com/hero.jpg");
    expect(image?.attrs?.alt).toBe("Hero image");
  });

  it("should preserve spacer through full round-trip", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSpacer",
          attrs: {
            height: 32,
          },
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    const spacer = parsedDoc.content?.find(
      (node) => node.type === "emailSpacer"
    );
    expect(spacer).toBeDefined();
    expect(spacer?.attrs?.height).toBe(32);
  });

  it("should preserve divider through full round-trip", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailDivider",
          attrs: {
            color: "#e5e7eb",
            margin: "24px 0",
          },
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    const divider = parsedDoc.content?.find(
      (node) => node.type === "emailDivider"
    );
    expect(divider).toBeDefined();
  });

  it("should preserve conditional blocks through full round-trip", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variable: "isPremium",
            operator: "equals",
            value: "true",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Premium content" }],
            },
          ],
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    const conditional = parsedDoc.content?.find(
      (node) => node.type === "conditional"
    );
    expect(conditional).toBeDefined();
    expect(conditional?.attrs?.variable).toBe("isPremium");
    expect(conditional?.attrs?.operator).toBe("equals");
    expect(conditional?.attrs?.value).toBe("true");
  });

  it("should preserve variables through full round-trip", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello, " },
            {
              type: "variable",
              attrs: {
                name: "firstName",
                label: "firstName",
                fallback: "there",
              },
            },
            { type: "text", text: "!" },
          ],
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    const paragraph = parsedDoc.content?.find(
      (node) => node.type === "paragraph"
    );
    expect(paragraph).toBeDefined();

    const variable = paragraph?.content?.find(
      (node) => node.type === "variable"
    );
    expect(variable).toBeDefined();
    expect(variable?.attrs?.name).toBe("firstName");
  });

  it("should preserve complex document with multiple components", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailPreview",
          attrs: { text: "Weekly newsletter" },
        },
        {
          type: "emailSection",
          attrs: { backgroundColor: "#f3f4f6", padding: "24px" },
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Welcome!" }],
            },
          ],
        },
        {
          type: "emailSpacer",
          attrs: { height: 24 },
        },
        {
          type: "emailButton",
          attrs: {
            href: "https://example.com",
            backgroundColor: "#3b82f6",
            color: "#ffffff",
          },
          content: [{ type: "text", text: "Get Started" }],
        },
      ],
    };

    const reactEmailCode = generateReactEmailCode(originalDoc);
    const parsedDoc = parseReactEmailToTipTap(reactEmailCode);

    // Verify all components are present
    expect(parsedDoc.content?.some((n) => n.type === "emailPreview")).toBe(
      true
    );
    expect(parsedDoc.content?.some((n) => n.type === "emailSection")).toBe(
      true
    );
    expect(parsedDoc.content?.some((n) => n.type === "emailSpacer")).toBe(true);
    expect(parsedDoc.content?.some((n) => n.type === "emailButton")).toBe(true);
  });
});

// ============================================================================
// Code Editing Round-Trip Tests (reproduces user bug: editing className breaks)
// ============================================================================

describe("Code Editing Round-Trip", () => {
  it("should parse generated code back after adding Tailwind classes to className", () => {
    // Step 1: Generate code from a TipTap doc
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    const code = generateReactEmailCode(originalDoc);

    // Step 2: Simulate user adding a Tailwind class to the Container className
    const editedCode = code.replace(
      'className="bg-white mx-auto p-[20px] max-w-[600px]"',
      'className="bg-white mx-auto p-[20px] max-w-[600px] rounded-lg"'
    );
    expect(editedCode).not.toBe(code); // Ensure the replacement happened

    // Step 3: Parse the edited code back - should NOT throw
    const parsedDoc = parseReactEmailToTipTap(editedCode);
    expect(parsedDoc.type).toBe("doc");
    expect(parsedDoc.content?.some((n) => n.type === "paragraph")).toBe(true);
  });

  it("should parse generated code back after editing Text className", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Some text" }],
        },
      ],
    };
    const code = generateReactEmailCode(originalDoc);

    // Add text-center to the Text component
    const editedCode = code.replace(
      'className="my-4 leading-relaxed text-left"',
      'className="my-4 leading-relaxed text-center font-bold"'
    );
    expect(editedCode).not.toBe(code);

    const parsedDoc = parseReactEmailToTipTap(editedCode);
    expect(parsedDoc.type).toBe("doc");
  });

  it("should parse generated code back after editing Section className", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSection",
          attrs: {
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "0",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "In a section" }],
            },
          ],
        },
      ],
    };
    const code = generateReactEmailCode(originalDoc);

    // Add rounded-lg to the Section
    const editedCode = code.replace(
      /(<Section className="[^"]+)"/,
      '$1 rounded-lg"'
    );
    expect(editedCode).not.toBe(code);

    const parsedDoc = parseReactEmailToTipTap(editedCode);
    expect(parsedDoc.type).toBe("doc");
    expect(parsedDoc.content?.some((n) => n.type === "emailSection")).toBe(
      true
    );
  });

  it("should parse code with variables (props.name) after editing", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            {
              type: "variable",
              attrs: {
                name: "userName",
                label: "userName",
                fallback: "",
                format: null,
              },
            },
          ],
        },
      ],
    };
    const code = generateReactEmailCode(originalDoc);

    // Should contain {props.userName}
    expect(code).toContain("{props.userName}");

    // Edit the code - add a class
    const editedCode = code.replace(
      'className="my-4 leading-relaxed text-left"',
      'className="my-4 leading-relaxed text-left text-lg"'
    );

    const parsedDoc = parseReactEmailToTipTap(editedCode);
    expect(parsedDoc.type).toBe("doc");
  });

  it("should parse generated code with styled text (highlight/textStyle marks)", () => {
    // This tests the triple-brace bug: style={{{ ... }}} was generated instead of style={{ ... }}
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Highlighted text",
              marks: [{ type: "highlight", attrs: { color: "#ffff00" } }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Colored text",
              marks: [
                {
                  type: "textStyle",
                  attrs: { color: "#ff0000", fontSize: "18px" },
                },
              ],
            },
          ],
        },
      ],
    };
    const code = generateReactEmailCode(originalDoc);

    // Verify the generated code has correct style syntax (double braces, not triple)
    expect(code).toContain("style={{");
    expect(code).not.toContain("style={{{");

    // Should parse back without errors
    const parsedDoc = parseReactEmailToTipTap(code);
    expect(parsedDoc.type).toBe("doc");
  });

  it("should parse generated code with linked text that has styles", () => {
    const originalDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Click here",
              marks: [
                { type: "link", attrs: { href: "https://example.com" } },
                { type: "textStyle", attrs: { color: "#0000ff" } },
              ],
            },
          ],
        },
      ],
    };
    const code = generateReactEmailCode(originalDoc);

    // Verify correct style syntax
    expect(code).not.toContain("style={{{");

    const parsedDoc = parseReactEmailToTipTap(code);
    expect(parsedDoc.type).toBe("doc");
  });

  it("should parse code with preview text containing template vars", () => {
    const code = `import { Html, Head, Body, Container, Text, Button, Section, Row, Column, Img, Hr, Heading, Link, Preview, Tailwind, pixelBasedPreset } from "@react-email/components";

export default function EmailTemplate() {
  return (
    <Html>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>{props.inviterName} invited you to join Wraps</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="bg-white mx-auto p-[20px] max-w-[600px]">
            <Text className="my-4 leading-relaxed text-left">Welcome!</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`;
    const parsedDoc = parseReactEmailToTipTap(code);
    expect(parsedDoc.type).toBe("doc");
    expect(parsedDoc.content?.some((n) => n.type === "paragraph")).toBe(true);
  });
});

// ============================================================================
// Wrapper Config Extraction & Preservation Tests
// ============================================================================

describe("extractWrapperConfig", () => {
  it("should extract Body and Container classNames from code", () => {
    const code = `<Body className="bg-gray-100 font-sans py-2.5">
      <Container className="bg-white mx-auto p-[20px] max-w-[600px] rounded-lg">`;
    const config = extractWrapperConfig(code);
    expect(config.bodyClassName).toBe("bg-gray-100 font-sans py-2.5");
    expect(config.containerClassName).toBe(
      "bg-white mx-auto p-[20px] max-w-[600px] rounded-lg"
    );
  });

  it("should return undefined when elements are missing", () => {
    const config = extractWrapperConfig("<Text>Hello</Text>");
    expect(config.bodyClassName).toBeUndefined();
    expect(config.containerClassName).toBeUndefined();
  });
});

describe("Wrapper className preservation", () => {
  it("should preserve custom Body className through code generation", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };
    const code = generateReactEmailCode(doc, 0, {
      bodyClassName: "bg-gray-100 font-sans py-2.5",
    });
    expect(code).toContain('className="bg-gray-100 font-sans py-2.5"');
  });

  it("should preserve custom Container className through code generation", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };
    const code = generateReactEmailCode(doc, 0, {
      containerClassName: "bg-white mx-auto p-[20px] max-w-[600px] rounded-lg",
    });
    expect(code).toContain(
      'className="bg-white mx-auto p-[20px] max-w-[600px] rounded-lg"'
    );
  });

  it("should use defaults when no wrapper options provided", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };
    const code = generateReactEmailCode(doc);
    expect(code).toContain('<Body className="bg-gray-100 font-sans">');
    expect(code).toContain(
      '<Container className="bg-white mx-auto p-[20px] max-w-[600px]">'
    );
  });

  it("should round-trip Body className: edit code → extract → regenerate", () => {
    // Step 1: Generate initial code
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };
    const initialCode = generateReactEmailCode(doc);

    // Step 2: Simulate user editing Body className
    const editedCode = initialCode.replace(
      'className="bg-gray-100 font-sans"',
      'className="bg-gray-100 font-sans py-2.5"'
    );

    // Step 3: Extract wrapper config from edited code
    const wrapperConfig = extractWrapperConfig(editedCode);
    expect(wrapperConfig.bodyClassName).toBe("bg-gray-100 font-sans py-2.5");

    // Step 4: Parse edited code to TipTap
    const parsed = parseReactEmailToTipTap(editedCode);

    // Step 5: Regenerate code with preserved wrapper config
    const regeneratedCode = generateReactEmailCode(parsed, 0, {
      ...wrapperConfig,
    });

    // Body className should be preserved
    expect(regeneratedCode).toContain(
      'className="bg-gray-100 font-sans py-2.5"'
    );
  });

  it("should read wrapper classNames from doc attrs (persisted in DB)", () => {
    // Simulate a doc that was saved with wrapper classNames in attrs
    const doc: JSONContent = {
      type: "doc",
      attrs: {
        bodyClassName: "bg-gray-100 font-sans py-2.5",
        containerClassName:
          "bg-white mx-auto p-[20px] max-w-[600px] rounded-lg",
      },
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };

    // generateReactEmailCode should use the doc attrs
    const code = generateReactEmailCode(doc);
    expect(code).toContain('<Body className="bg-gray-100 font-sans py-2.5">');
    expect(code).toContain(
      '<Container className="bg-white mx-auto p-[20px] max-w-[600px] rounded-lg">'
    );
  });

  it("should persist wrapper classNames through full round-trip with doc attrs", () => {
    // Step 1: Generate code from doc with custom attrs
    const doc: JSONContent = {
      type: "doc",
      attrs: {
        bodyClassName: "bg-gray-100 font-sans py-2.5",
        containerClassName: "bg-white mx-auto p-[20px] max-w-[600px]",
      },
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };
    const code = generateReactEmailCode(doc);
    expect(code).toContain('className="bg-gray-100 font-sans py-2.5"');

    // Step 2: Parse code back to TipTap
    const parsed = parseReactEmailToTipTap(code);

    // Step 3: Extract wrapper config and inject into doc attrs (as code-view does)
    const wrapperConfig = extractWrapperConfig(code);
    if (parsed.type === "doc") {
      parsed.attrs = {
        ...parsed.attrs,
        bodyClassName: wrapperConfig.bodyClassName || null,
        containerClassName: wrapperConfig.containerClassName || null,
      };
    }

    // Step 4: Regenerate code from the parsed doc (with attrs)
    const regenerated = generateReactEmailCode(parsed);
    expect(regenerated).toContain(
      '<Body className="bg-gray-100 font-sans py-2.5">'
    );
  });
});

// ============================================================================
// React Email Demo Template Parsing Tests
// These test that real-world React Email patterns are parseable
// ============================================================================

describe("React Email Template Patterns", () => {
  it("should parse a Vercel invite-style template", () => {
    const code = `import { Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text, Tailwind, pixelBasedPreset } from "@react-email/components";

export default function VercelInviteEmail() {
  return (
    <Html>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>Join the team on Vercel</Preview>
        <Body className="bg-white font-sans">
          <Container className="mx-auto py-[20px] px-[12px] max-w-[560px]">
            <Img src="https://example.com/logo.png" width="48" height="48" alt="Logo" />
            <Heading as="h1" className="text-2xl font-bold my-4">Join the team</Heading>
            <Text className="my-4 leading-relaxed text-left">Hello there,</Text>
            <Text className="my-4 leading-relaxed text-left">You have been invited to join a team.</Text>
            <Section className="bg-gray-50 p-6 rounded-lg my-4">
              <Text className="my-4 leading-relaxed text-center">
                Team Name
              </Text>
            </Section>
            <Button href="https://example.com/invite" className="bg-indigo-600 text-white px-6 py-3 rounded-md font-semibold">
              Join Team
            </Button>
            <Hr className="border-gray-200 my-6" />
            <Text className="my-4 leading-relaxed text-left text-sm text-gray-500">
              If you did not expect this invitation, you can ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`;
    const result = parseReactEmailToTipTap(code);
    expect(result.type).toBe("doc");
    expect(result.content?.some((n) => n.type === "emailSection")).toBe(true);
    expect(result.content?.some((n) => n.type === "emailButton")).toBe(true);
    expect(result.content?.some((n) => n.type === "heading")).toBe(true);
    expect(result.content?.some((n) => n.type === "emailDivider")).toBe(true);
    expect(result.content?.some((n) => n.type === "emailImage")).toBe(true);
  });

  it("should parse a welcome email template with multiple sections", () => {
    const code = `import { Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Row, Column, Text, Tailwind, pixelBasedPreset } from "@react-email/components";

export default function WelcomeEmail() {
  return (
    <Html>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>Welcome to our platform</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="bg-white mx-auto p-[20px] max-w-[600px]">
            <Section className="bg-indigo-600 p-8 rounded-lg">
              <Heading as="h1" className="text-3xl font-bold text-center">Welcome!</Heading>
            </Section>
            <Section className="bg-white p-6">
              <Text className="my-4 leading-relaxed text-left">Thanks for signing up. Here are some things you can do:</Text>
              <Row>
                <Column className="w-[50%]">
                  <Text className="my-4 leading-relaxed text-left">Feature One</Text>
                </Column>
                <Column className="w-[50%]">
                  <Text className="my-4 leading-relaxed text-left">Feature Two</Text>
                </Column>
              </Row>
            </Section>
            <Button href="https://example.com/dashboard" className="bg-blue-600 text-white px-8 py-3 rounded-md">
              Go to Dashboard
            </Button>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`;
    const result = parseReactEmailToTipTap(code);
    expect(result.type).toBe("doc");
    expect(
      result.content?.filter((n) => n.type === "emailSection").length
    ).toBeGreaterThanOrEqual(2);
    expect(result.content?.some((n) => n.type === "emailButton")).toBe(true);
  });

  it("should parse a receipt email template with inline styles", () => {
    const code = `import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Row, Column, Text, Tailwind, pixelBasedPreset } from "@react-email/components";

export default function ReceiptEmail() {
  return (
    <Html>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>Your receipt from Acme</Preview>
        <Body className="bg-white font-sans">
          <Container className="mx-auto p-[20px] max-w-[600px]">
            <Heading as="h1" className="text-2xl font-bold my-4">Receipt</Heading>
            <Text className="my-4 leading-relaxed text-left text-gray-500">Order #12345</Text>
            <Hr className="border-gray-200 my-6" />
            <Row>
              <Column className="w-[60%]">
                <Text className="my-4 leading-relaxed text-left font-semibold">Item</Text>
              </Column>
              <Column className="w-[40%]">
                <Text className="my-4 leading-relaxed text-right font-semibold">Price</Text>
              </Column>
            </Row>
            <Hr className="border-gray-200 my-6" />
            <Row>
              <Column className="w-[60%]">
                <Text className="my-4 leading-relaxed text-left">Widget Pro</Text>
              </Column>
              <Column className="w-[40%]">
                <Text className="my-4 leading-relaxed text-right">$49.99</Text>
              </Column>
            </Row>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`;
    const result = parseReactEmailToTipTap(code);
    expect(result.type).toBe("doc");
    expect(result.content?.some((n) => n.type === "heading")).toBe(true);
    expect(result.content?.some((n) => n.type === "emailDivider")).toBe(true);
    expect(result.content?.some((n) => n.type === "emailRow")).toBe(true);
  });

  it("should parse a notification email template", () => {
    const code = `import { Body, Button, Container, Head, Html, Img, Link, Preview, Section, Text, Tailwind, pixelBasedPreset } from "@react-email/components";

export default function NotificationEmail() {
  return (
    <Html>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>New notification</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="bg-white mx-auto p-[20px] max-w-[600px] rounded-lg">
            <Img src="https://example.com/avatar.png" width="40" height="40" alt="User" className="rounded-full" />
            <Text className="my-4 leading-relaxed text-left">
              <Link href="https://example.com/user/jane">Jane</Link> commented on your post.
            </Text>
            <Section className="bg-gray-50 p-4 rounded-md">
              <Text className="my-4 leading-relaxed text-left text-gray-600">
                This looks great! I would love to collaborate on this project.
              </Text>
            </Section>
            <Button href="https://example.com/post/123" className="bg-blue-500 text-white px-6 py-3 rounded-md">
              View Comment
            </Button>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}`;
    const result = parseReactEmailToTipTap(code);
    expect(result.type).toBe("doc");
    expect(result.content?.some((n) => n.type === "emailImage")).toBe(true);
    expect(result.content?.some((n) => n.type === "emailSection")).toBe(true);
    expect(result.content?.some((n) => n.type === "emailButton")).toBe(true);
  });

  it("should parse a minimal React Email template", () => {
    const code = `import { Html, Text } from "@react-email/components";

export default function Email() {
  return (
    <Html>
      <Text>Hello</Text>
    </Html>
  );
}`;
    const result = parseReactEmailToTipTap(code);
    expect(result.type).toBe("doc");
    expect(result.content?.some((n) => n.type === "paragraph")).toBe(true);
  });

  it("should parse template with JSX fragment", () => {
    const code = `import { Text, Heading } from "@react-email/components";

export default function Email() {
  return (
    <>
      <Heading as="h1">Title</Heading>
      <Text>Content</Text>
    </>
  );
}`;
    const result = parseReactEmailToTipTap(code);
    expect(result.type).toBe("doc");
    expect(result.content?.some((n) => n.type === "heading")).toBe(true);
    expect(result.content?.some((n) => n.type === "paragraph")).toBe(true);
  });

  it("should parse template with style objects", () => {
    const code = `import { Section, Text } from "@react-email/components";

export default function Email() {
  return (
    <Section style={{ backgroundColor: "#f0f0f0", padding: "16px", borderRadius: "8px" }}>
      <Text style={{ color: "#333333", fontSize: "14px" }}>Styled text</Text>
    </Section>
  );
}`;
    const result = parseReactEmailToTipTap(code);
    expect(result.type).toBe("doc");
    expect(result.content?.some((n) => n.type === "emailSection")).toBe(true);
  });
});

// ============================================================================
// Additional Tests for 100% Coverage
// ============================================================================

describe("TipTap to React Email - Extended Coverage", () => {
  describe("Text Marks", () => {
    it("should render bold text", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Bold text",
                marks: [{ type: "bold" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('className="font-bold"');
      expect(result).toContain("Bold text");
    });

    it("should render italic text", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Italic text",
                marks: [{ type: "italic" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('className="italic"');
    });

    it("should render underlined text", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Underlined",
                marks: [{ type: "underline" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('className="underline"');
    });

    it("should render strikethrough text", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Strikethrough",
                marks: [{ type: "strike" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('className="line-through"');
    });

    it("should render linked text", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click me",
                marks: [
                  { type: "link", attrs: { href: "https://example.com" } },
                ],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain("<Link");
    });

    it("should render highlighted text", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Highlighted",
                marks: [{ type: "highlight", attrs: { color: "#ffff00" } }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('backgroundColor: "#ffff00"');
    });

    it("should render text with custom color and font size", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Styled",
                marks: [
                  {
                    type: "textStyle",
                    attrs: { color: "#ff0000", fontSize: "18px" },
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('color: "#ff0000"');
      expect(result).toContain('fontSize: "18px"');
    });

    it("should combine multiple marks", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Bold and italic",
                marks: [{ type: "bold" }, { type: "italic" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("font-bold");
      expect(result).toContain("italic");
    });
  });

  describe("Heading Levels", () => {
    it("should render all heading levels (1-6)", () => {
      for (let level = 1; level <= 6; level++) {
        const doc: JSONContent = {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level },
              content: [{ type: "text", text: `H${level} Heading` }],
            },
          ],
        };
        const result = generateReactEmailCode(doc);
        expect(result).toContain(`as="h${level}"`);
        expect(result).toContain(`H${level} Heading`);
      }
    });

    it("should render heading with text alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, textAlign: "center" },
            content: [{ type: "text", text: "Centered Heading" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("text-center");
    });

    it("should render heading with right alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2, textAlign: "right" },
            content: [{ type: "text", text: "Right Aligned" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("text-right");
    });

    it("should render heading with justify alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 3, textAlign: "justify" },
            content: [{ type: "text", text: "Justified" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("text-justify");
    });
  });

  describe("Paragraph Alignment", () => {
    it("should render paragraph with center alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [{ type: "text", text: "Centered paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("text-center");
    });

    it("should render paragraph with right alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "right" },
            content: [{ type: "text", text: "Right aligned" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("text-right");
    });

    it("should render paragraph with justify alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "justify" },
            content: [{ type: "text", text: "Justified text" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("text-justify");
    });
  });

  describe("Email Avatar", () => {
    it("should generate avatar with default settings", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailAvatar",
            attrs: {
              src: "https://example.com/avatar.jpg",
              alt: "User Avatar",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('src="https://example.com/avatar.jpg"');
      expect(result).toContain('alt="User Avatar"');
      expect(result).toContain('borderRadius: "9999px"'); // circle shape
    });

    it("should generate avatar with custom size and shape", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailAvatar",
            attrs: {
              src: "https://example.com/avatar.jpg",
              size: 128,
              shape: "rounded",
              align: "left",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("width={128}");
      expect(result).toContain("height={128}");
      expect(result).toContain('borderRadius: "8px"'); // rounded shape
      expect(result).toContain('className="text-left"');
    });

    it("should generate avatar with square shape", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailAvatar",
            attrs: {
              src: "https://example.com/avatar.jpg",
              shape: "square",
              align: "right",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('borderRadius: "0"'); // square
      expect(result).toContain('className="text-right"');
    });
  });

  describe("Email Code Block", () => {
    it("should generate code block with default settings", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailCodeBlock",
            attrs: {
              code: "const x = 1;",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("<pre");
      expect(result).toContain("<code>");
      expect(result).toContain("const x = 1;");
      expect(result).toContain('backgroundColor: "#1e1e1e"');
    });

    it("should generate code block with custom colors", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailCodeBlock",
            attrs: {
              code: "function hello() {}",
              backgroundColor: "#282c34",
              textColor: "#abb2bf",
              padding: "24px",
              borderRadius: "12px",
              fontSize: "16px",
              fontFamily: "Monaco, monospace",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('backgroundColor: "#282c34"');
      expect(result).toContain('color: "#abb2bf"');
      expect(result).toContain('padding: "24px"');
      expect(result).toContain('borderRadius: "12px"');
      expect(result).toContain('fontSize: "16px"');
      expect(result).toContain('fontFamily: "Monaco, monospace"');
    });

    it("should escape special characters in code", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailCodeBlock",
            attrs: {
              code: "const str = `Hello $name`",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      // Should escape backticks and dollar signs
      expect(result).toContain("\\`");
      expect(result).toContain("\\$");
    });
  });

  describe("Email Social Links", () => {
    it("should generate social links with icons", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSocialLinks",
            attrs: {
              links: [
                { platform: "twitter", url: "https://twitter.com/user" },
                { platform: "linkedin", url: "https://linkedin.com/in/user" },
              ],
              iconSize: 24,
              iconColor: "#333333",
              style: "icons",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('href="https://twitter.com/user"');
      expect(result).toContain('href="https://linkedin.com/in/user"');
      expect(result).toContain("img.icons8.com");
    });

    it("should generate social links with text only", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSocialLinks",
            attrs: {
              links: [{ platform: "github", url: "https://github.com/user" }],
              style: "text",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("GitHub");
      expect(result).toContain('href="https://github.com/user"');
    });

    it("should generate social links with both icons and text", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSocialLinks",
            attrs: {
              links: [
                { platform: "instagram", url: "https://instagram.com/user" },
              ],
              style: "both",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("Instagram");
      expect(result).toContain("img.icons8.com");
    });

    it("should handle empty social links", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSocialLinks",
            attrs: {
              links: [],
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("No links configured");
    });

    it("should handle all social platforms", () => {
      const platforms = [
        "twitter",
        "linkedin",
        "instagram",
        "facebook",
        "youtube",
        "github",
      ];
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSocialLinks",
            attrs: {
              links: platforms.map((platform) => ({
                platform,
                url: `https://${platform}.com/user`,
              })),
              align: "left",
              iconSpacing: "8px",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("text-left");
      for (const platform of platforms) {
        expect(result).toContain(`https://${platform}.com/user`);
      }
    });
  });

  describe("Button Alignment", () => {
    it("should render left-aligned button", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "#",
              align: "left",
            },
            content: [{ type: "text", text: "Left" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('className="text-left"');
    });

    it("should render button with custom font weight", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "#",
              fontWeight: "700",
            },
            content: [{ type: "text", text: "Bold" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("font-bold");
    });

    it("should render button with normal font weight", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "#",
              fontWeight: "400",
            },
            content: [{ type: "text", text: "Normal" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("font-normal");
    });

    it("should render button with custom border radius", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "#",
              borderRadius: "0px",
            },
            content: [{ type: "text", text: "Square" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("rounded-none");
    });

    it("should render button with full border radius", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "#",
              borderRadius: "9999px",
            },
            content: [{ type: "text", text: "Pill" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("rounded-full");
    });
  });

  describe("Image with Link", () => {
    it("should render image with href", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailImage",
            attrs: {
              src: "https://example.com/image.png",
              alt: "Clickable Image",
              href: "https://example.com",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('<Link href="https://example.com"');
      expect(result).toContain('src="https://example.com/image.png"');
    });

    it("should render image with custom border radius and object fit", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailImage",
            attrs: {
              src: "https://example.com/image.png",
              borderRadius: "16px",
              objectFit: "cover",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('borderRadius: "16px"');
      expect(result).toContain('objectFit: "cover"');
    });

    it("should render image with left alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailImage",
            attrs: {
              src: "https://example.com/image.png",
              align: "left",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('className="text-left"');
    });

    it("should render image with right alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailImage",
            attrs: {
              src: "https://example.com/image.png",
              align: "right",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('className="text-right"');
    });

    it("should render image with pixel dimensions", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailImage",
            attrs: {
              src: "https://example.com/image.png",
              width: "400px",
              height: "300px",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("w-[400px]");
      expect(result).toContain("h-[300px]");
    });
  });

  describe("Section Styling", () => {
    it("should render section with zero padding", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSection",
            attrs: {
              padding: "0px",
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("p-0");
    });

    it("should render section with zero border radius", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSection",
            attrs: {
              borderRadius: "0px",
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("rounded-none");
    });

    it("should render section with black background", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailSection",
            attrs: {
              backgroundColor: "#000000",
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("bg-black");
    });
  });

  describe("Divider Styling", () => {
    it("should render divider with custom color", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailDivider",
            attrs: {
              borderColor: "#ff0000",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("border-[#ff0000]");
    });

    it("should render divider with custom margin", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailDivider",
            attrs: {
              margin: "48px",
            },
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("my-[48px]");
    });
  });

  describe("Conditional Rendering", () => {
    it("should generate conditional with equals operator", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "conditional",
            attrs: {
              variable: "status",
              operator: "equals",
              value: "active",
            },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Active user" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("props.status === ");
    });

    it("should generate conditional with notEquals operator", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "conditional",
            attrs: {
              variable: "status",
              operator: "notEquals",
              value: "inactive",
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("!==");
    });

    it("should generate conditional with greaterThan operator", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "conditional",
            attrs: {
              variable: "count",
              operator: "greaterThan",
              value: 10,
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("props.count >");
    });

    it("should generate conditional with lessThan operator", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "conditional",
            attrs: {
              variable: "count",
              operator: "lessThan",
              value: 5,
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("props.count <");
    });

    it("should generate conditional with contains operator", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "conditional",
            attrs: {
              variable: "email",
              operator: "contains",
              value: "@gmail",
            },
            content: [{ type: "paragraph" }],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain(".includes");
    });
  });

  describe("Row and Column Styling", () => {
    it("should generate column with padding", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailRow",
            content: [
              {
                type: "emailColumn",
                attrs: {
                  padding: "16px",
                },
                content: [{ type: "paragraph" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('padding: "16px"');
    });

    it("should generate column with vertical alignment", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailRow",
            content: [
              {
                type: "emailColumn",
                attrs: {
                  verticalAlign: "middle",
                },
                content: [{ type: "paragraph" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('verticalAlign: "middle"');
    });

    it("should generate column with background color", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailRow",
            content: [
              {
                type: "emailColumn",
                attrs: {
                  backgroundColor: "#f0f0f0",
                },
                content: [{ type: "paragraph" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain('backgroundColor: "#f0f0f0"');
    });
  });

  describe("Blockquote", () => {
    it("should generate blockquote", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "A wise quote" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("<blockquote");
      expect(result).toContain("border-l-4");
      expect(result).toContain("A wise quote");
    });
  });

  describe("Unknown Node Types", () => {
    it("should handle unknown node types with content", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "unknownNode",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Nested content" }],
              },
            ],
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toContain("Nested content");
    });

    it("should handle unknown node types without content", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "unknownNode",
          },
        ],
      };
      const result = generateReactEmailCode(doc);
      expect(result).toBeDefined();
    });
  });
});

describe("HTML to TipTap - Extended Coverage", () => {
  describe("Table Elements", () => {
    it("should parse table rows", () => {
      const html = "<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>";
      const result = parseHTMLToTipTap(html);
      expect(result.type).toBe("doc");
      // Table rows are converted to emailRow
      expect(result.content?.some((node) => node.type === "emailRow")).toBe(
        true
      );
    });

    it("should parse table cells as sections", () => {
      const html = "<table><tr><td>Content</td></tr></table>";
      const result = parseHTMLToTipTap(html);
      expect(result.type).toBe("doc");
    });
  });

  describe("Semantic Elements", () => {
    it("should parse article as section", () => {
      const html =
        '<article style="padding: 20px;"><p>Article content</p></article>';
      const result = parseHTMLToTipTap(html);
      expect(result.content?.some((node) => node.type === "emailSection")).toBe(
        true
      );
    });

    it("should parse header as section", () => {
      const html = "<header><h1>Title</h1></header>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.some((node) => node.type === "emailSection")).toBe(
        true
      );
    });

    it("should parse footer as section", () => {
      const html = "<footer><p>Footer text</p></footer>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.some((node) => node.type === "emailSection")).toBe(
        true
      );
    });

    it("should parse main as section", () => {
      const html = "<main><p>Main content</p></main>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.some((node) => node.type === "emailSection")).toBe(
        true
      );
    });

    it("should parse aside as section", () => {
      const html = "<aside><p>Sidebar</p></aside>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.some((node) => node.type === "emailSection")).toBe(
        true
      );
    });
  });

  describe("Inline Elements", () => {
    it("should parse b tag as bold", () => {
      const html = "<p><b>Bold</b></p>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0].content).toContainEqual({
        type: "text",
        text: "Bold",
        marks: [{ type: "bold" }],
      });
    });

    it("should parse i tag as italic", () => {
      const html = "<p><i>Italic</i></p>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0].content).toContainEqual({
        type: "text",
        text: "Italic",
        marks: [{ type: "italic" }],
      });
    });

    it("should parse u tag as underline", () => {
      const html = "<p><u>Underlined</u></p>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0].content).toContainEqual({
        type: "text",
        text: "Underlined",
        marks: [{ type: "underline" }],
      });
    });

    it("should parse span without marks", () => {
      const html = "<p><span>Plain text</span></p>";
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0].content?.[0].text).toBe("Plain text");
    });
  });

  describe("Button Detection", () => {
    it("should detect button by class attribute", () => {
      const html =
        '<a href="https://example.com" class="button primary">Click</a>';
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0]).toMatchObject({
        type: "emailButton",
        attrs: {
          href: "https://example.com",
        },
      });
    });

    it("should detect button by btn class", () => {
      const html = '<a href="#" class="btn btn-primary">Action</a>';
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0].type).toBe("emailButton");
    });
  });

  describe("Divider Styling", () => {
    it("should parse hr with border styling", () => {
      const html =
        '<hr style="border-color: #ff0000; border-width: 2px; margin: 16px;" />';
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0]).toMatchObject({
        type: "emailDivider",
        attrs: {
          color: "#ff0000",
          thickness: "2px",
          margin: "16px",
        },
      });
    });

    it("should parse hr with background styling", () => {
      const html = '<hr style="background-color: #0000ff; height: 3px;" />';
      const result = parseHTMLToTipTap(html);
      expect(result.content?.[0]).toMatchObject({
        type: "emailDivider",
        attrs: {
          color: "#0000ff",
          thickness: "3px",
        },
      });
    });
  });
});

describe("React Email to TipTap - Extended Coverage", () => {
  describe("Row and Column Components", () => {
    it("should parse Row and Column components", () => {
      const code = `
        import { Row, Column, Text } from "@react-email/components";
        export default function Email() {
          return (
            <Row>
              <Column>
                <Text>Column 1</Text>
              </Column>
              <Column>
                <Text>Column 2</Text>
              </Column>
            </Row>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      const row = result.content?.find((node) => node.type === "emailRow");
      expect(row).toBeDefined();
      expect(row?.content?.length).toBe(2);
    });
  });

  describe("Preview Text", () => {
    it("should parse Preview component", () => {
      const code = `
        import { Html, Body, Preview, Text } from "@react-email/components";
        export default function Email() {
          return (
            <Html>
              <Body>
                <Preview>This is a preview</Preview>
                <Text>Body content</Text>
              </Body>
            </Html>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);

      const preview = result.content?.find(
        (node) => node.type === "emailPreview"
      );
      expect(preview).toBeDefined();
      expect(preview?.attrs?.text).toBe("This is a preview");
    });
  });

  describe("Tailwind Class Parsing - Extended", () => {
    it("should parse bracket syntax for background color", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="bg-[#ff5500]"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.backgroundColor).toBe("#ff5500");
    });

    it("should parse bracket syntax for text color", () => {
      const code = `
        import { Button } from "@react-email/components";
        export default function Email() {
          return <Button href="#" className="text-[#123456]">Text</Button>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.color).toBe("#123456");
    });

    it("should parse bracket syntax for font size", () => {
      const code = `
        import { Text } from "@react-email/components";
        export default function Email() {
          return <Text className="text-[14px]">Small text</Text>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]).toBeDefined();
    });

    it("should parse all text size classes", () => {
      const sizes = [
        "xs",
        "sm",
        "base",
        "lg",
        "xl",
        "2xl",
        "3xl",
        "4xl",
        "5xl",
      ];
      for (const size of sizes) {
        const code = `
          import { Text } from "@react-email/components";
          export default function Email() {
            return <Text className="text-${size}">Size ${size}</Text>;
          }
        `;
        const result = parseReactEmailToTipTap(code);
        expect(result.content?.[0]).toBeDefined();
      }
    });

    it("should parse px padding", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="px-4"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]).toBeDefined();
    });

    it("should parse py padding", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="py-4"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]).toBeDefined();
    });

    it("should parse individual padding classes (pt, pr, pb, pl)", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="pt-2 pr-4 pb-6 pl-8"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]).toBeDefined();
    });

    it("should parse margin classes (mx, my, m)", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="mx-4 my-2 m-1"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]).toBeDefined();
    });

    it("should parse individual margin classes (mt, mr, mb, ml)", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="mt-2 mr-4 mb-6 ml-8"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]).toBeDefined();
    });

    it("should parse bracket syntax for border radius", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="rounded-[12px]"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.borderRadius).toBe("12px");
    });

    it("should parse all border radius classes", () => {
      const radii = ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];
      for (const radius of radii) {
        const code = `
          import { Section } from "@react-email/components";
          export default function Email() {
            return <Section className="rounded-${radius}"><p>Test</p></Section>;
          }
        `;
        const result = parseReactEmailToTipTap(code);
        expect(result.content?.[0]).toBeDefined();
      }
    });

    it("should parse default rounded class", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="rounded"><p>Test</p></Section>;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.borderRadius).toBe("4px");
    });

    it("should parse all font weight classes", () => {
      const weights = [
        "thin",
        "extralight",
        "light",
        "normal",
        "medium",
        "semibold",
        "bold",
        "extrabold",
        "black",
      ];
      for (const weight of weights) {
        const code = `
          import { Button } from "@react-email/components";
          export default function Email() {
            return <Button href="#" className="font-${weight}">Weight ${weight}</Button>;
          }
        `;
        const result = parseReactEmailToTipTap(code);
        expect(result.content?.[0]).toBeDefined();
      }
    });

    it("should parse text alignment classes", () => {
      const alignments = ["left", "center", "right", "justify"];
      for (const align of alignments) {
        const code = `
          import { Text } from "@react-email/components";
          export default function Email() {
            return <Text className="text-${align}">Aligned ${align}</Text>;
          }
        `;
        const result = parseReactEmailToTipTap(code);
        expect(result.content?.[0]).toBeDefined();
      }
    });

    it("should parse width and height classes", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="test.png" className="w-[500px] h-[300px]" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.width).toBe("500px");
      expect(result.content?.[0]?.attrs?.height).toBe("300px");
    });

    it("should parse max-width class", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="test.png" className="max-w-[400px]" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.width).toBe("400px");
    });

    it("should parse w-full class", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="test.png" className="w-full" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.width).toBe("100%");
    });

    it("should parse h-auto class", () => {
      const code = `
        import { Img } from "@react-email/components";
        export default function Email() {
          return <Img src="test.png" className="h-auto" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      expect(result.content?.[0]?.attrs?.height).toBe("auto");
    });
  });

  describe("Conditional Expression Parsing", () => {
    it("should parse equals condition in Section", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email(props) {
          return (
            <Section>
              {props.status === "active" && <Text>Active</Text>}
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const section = result.content?.find((n) => n.type === "emailSection");
      const conditional = section?.content?.find(
        (n) => n.type === "conditional"
      );
      expect(conditional).toBeDefined();
      expect(conditional?.attrs?.variable).toBe("status");
      expect(conditional?.attrs?.operator).toBe("equals");
      expect(conditional?.attrs?.value).toBe("active");
    });

    it("should parse notEquals condition in Section", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email(props) {
          return (
            <Section>
              {props.type !== "guest" && <Text>Member</Text>}
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const section = result.content?.find((n) => n.type === "emailSection");
      const conditional = section?.content?.find(
        (n) => n.type === "conditional"
      );
      expect(conditional).toBeDefined();
      expect(conditional?.attrs?.operator).toBe("notEquals");
    });

    it("should parse greaterThan condition in Section", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email(props) {
          return (
            <Section>
              {props.count > 10 && <Text>Many</Text>}
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const section = result.content?.find((n) => n.type === "emailSection");
      const conditional = section?.content?.find(
        (n) => n.type === "conditional"
      );
      expect(conditional).toBeDefined();
      expect(conditional?.attrs?.operator).toBe("greaterThan");
    });

    it("should parse lessThan condition in Section", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email(props) {
          return (
            <Section>
              {props.count < 5 && <Text>Few</Text>}
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const section = result.content?.find((n) => n.type === "emailSection");
      const conditional = section?.content?.find(
        (n) => n.type === "conditional"
      );
      expect(conditional).toBeDefined();
      expect(conditional?.attrs?.operator).toBe("lessThan");
    });

    it("should parse exists condition in Section", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email(props) {
          return (
            <Section>
              {props.optional && <Text>Has optional</Text>}
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const section = result.content?.find((n) => n.type === "emailSection");
      const conditional = section?.content?.find(
        (n) => n.type === "conditional"
      );
      expect(conditional).toBeDefined();
      expect(conditional?.attrs?.operator).toBe("exists");
    });

    it("should parse notExists condition in Section", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email(props) {
          return (
            <Section>
              {!props.missing && <Text>Missing</Text>}
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const section = result.content?.find((n) => n.type === "emailSection");
      const conditional = section?.content?.find(
        (n) => n.type === "conditional"
      );
      expect(conditional).toBeDefined();
      expect(conditional?.attrs?.operator).toBe("notExists");
    });

    it("should parse condition with numeric value in Section", () => {
      const code = `
        import { Section, Text } from "@react-email/components";
        export default function Email(props) {
          return (
            <Section>
              {props.age === 18 && <Text>Adult</Text>}
            </Section>
          );
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const section = result.content?.find((n) => n.type === "emailSection");
      const conditional = section?.content?.find(
        (n) => n.type === "conditional"
      );
      expect(conditional).toBeDefined();
      expect(conditional?.attrs?.value).toBe("18");
    });
  });

  describe("Hr Component Parsing", () => {
    it("should parse Hr with border color class", () => {
      const code = `
        import { Hr } from "@react-email/components";
        export default function Email() {
          return <Hr className="border-red-500" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const divider = result.content?.find((n) => n.type === "emailDivider");
      expect(divider).toBeDefined();
    });

    it("should parse Hr with margin classes", () => {
      const code = `
        import { Hr } from "@react-email/components";
        export default function Email() {
          return <Hr className="my-8" />;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      const divider = result.content?.find((n) => n.type === "emailDivider");
      expect(divider).toBeDefined();
    });
  });

  describe("Spacer Parsing", () => {
    it("should parse Section with height as spacer", () => {
      const code = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section style={{ height: "32px" }} />;
        }
      `;
      const result = parseReactEmailToTipTap(code);
      // Check that the result is parsed
      expect(result.content).toBeDefined();
    });
  });

  describe("Multiple Color Palettes", () => {
    it("should parse all Tailwind color palettes", () => {
      const colors = [
        "slate",
        "gray",
        "zinc",
        "neutral",
        "stone",
        "red",
        "orange",
        "amber",
        "yellow",
        "lime",
        "green",
        "emerald",
        "teal",
        "cyan",
        "sky",
        "blue",
        "indigo",
        "violet",
        "purple",
        "fuchsia",
        "pink",
        "rose",
      ];
      for (const color of colors) {
        const code = `
          import { Section } from "@react-email/components";
          export default function Email() {
            return <Section className="bg-${color}-500"><p>Test</p></Section>;
          }
        `;
        const result = parseReactEmailToTipTap(code);
        expect(result.content?.[0]?.attrs?.backgroundColor).toBeDefined();
      }
    });

    it("should parse white and black colors", () => {
      const code1 = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="bg-white"><p>Test</p></Section>;
        }
      `;
      const result1 = parseReactEmailToTipTap(code1);
      expect(result1.content?.[0]?.attrs?.backgroundColor).toBe("#ffffff");

      const code2 = `
        import { Section } from "@react-email/components";
        export default function Email() {
          return <Section className="bg-black"><p>Test</p></Section>;
        }
      `;
      const result2 = parseReactEmailToTipTap(code2);
      expect(result2.content?.[0]?.attrs?.backgroundColor).toBe("#000000");
    });
  });
});

// ============================================================================
// React Component Rendering Tests
// ============================================================================

describe("tiptapToReactEmail Function", () => {
  it("should return a valid React element", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello World" }],
        },
      ],
    };
    const result = tiptapToReactEmail(doc);
    expect(result).toBeDefined();
    expect(result.type).toBeDefined();
  });

  it("should include preview text when provided in options", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };
    const result = tiptapToReactEmail(doc, {}, { previewText: "My Preview" });
    expect(result).toBeDefined();
  });

  it("should apply brand kit colors", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };
    const result = tiptapToReactEmail(
      doc,
      {},
      {
        brandKit: {
          primaryColor: "#ff0000",
          secondaryColor: "#00ff00",
          backgroundColor: "#0000ff",
          textColor: "#ffffff",
          fontFamily: "Arial, sans-serif",
          headingFontFamily: "Georgia, serif",
          buttonRadius: "8px",
          darkPrimaryColor: "#ff6666",
          darkSecondaryColor: "#66ff66",
          darkBackgroundColor: "#000066",
          darkTextColor: "#eeeeee",
        },
      }
    );
    expect(result).toBeDefined();
  });

  it("should resolve variables with test data", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            {
              type: "variable",
              attrs: { name: "userName", fallback: "Friend" },
            },
          ],
        },
      ],
    };
    const result = tiptapToReactEmail(doc, { userName: "John" });
    expect(result).toBeDefined();
  });

  it("should keep variables as placeholders when option is set", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: { name: "email", fallback: "test@example.com" },
            },
          ],
        },
      ],
    };
    const result = tiptapToReactEmail(
      doc,
      {},
      { keepVariablesAsPlaceholders: true }
    );
    expect(result).toBeDefined();
  });
});

describe("renderTipTapToHtml Function", () => {
  it("should render a basic document to HTML", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello World" }],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Hello World");
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("<html");
  });

  it("should include preview text in HTML output", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Email body" }],
        },
      ],
    };
    const html = await renderTipTapToHtml(
      doc,
      {},
      { previewText: "My Preview" }
    );
    expect(html).toContain("My Preview");
    expect(html).toContain("Email body");
  });

  it("should resolve variables in HTML output", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            {
              type: "variable",
              attrs: { name: "name", fallback: "there" },
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc, { name: "John" });
    expect(html).toContain("John");
  });

  it("should use fallback when variable is not in test data", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "variable",
              attrs: { name: "missing", fallback: "default value" },
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc, {});
    expect(html).toContain("default value");
  });

  it("should render complex document with all components", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Welcome" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body text" }],
        },
        {
          type: "emailButton",
          attrs: {
            href: "https://example.com",
            backgroundColor: "#3b82f6",
            color: "#ffffff",
            borderRadius: "8px",
          },
          content: [{ type: "text", text: "Click Me" }],
        },
        {
          type: "emailDivider",
          attrs: { color: "#e5e7eb" },
        },
        {
          type: "emailImage",
          attrs: {
            src: "https://example.com/image.png",
            alt: "Test Image",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Welcome");
    expect(html).toContain("Body text");
    expect(html).toContain("Click Me");
    expect(html).toContain("https://example.com");
  });
});

describe("Conditional Evaluation", () => {
  it("should evaluate equals condition correctly", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "status",
            operator: "equals",
            value: "active",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Active content" }],
            },
          ],
        },
      ],
    };
    const htmlActive = await renderTipTapToHtml(doc, { status: "active" });
    expect(htmlActive).toContain("Active content");

    const htmlInactive = await renderTipTapToHtml(doc, { status: "inactive" });
    expect(htmlInactive).not.toContain("Active content");
  });

  it("should evaluate notEquals condition correctly", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "type",
            operator: "notEquals",
            value: "guest",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Member content" }],
            },
          ],
        },
      ],
    };
    const htmlMember = await renderTipTapToHtml(doc, { type: "member" });
    expect(htmlMember).toContain("Member content");

    const htmlGuest = await renderTipTapToHtml(doc, { type: "guest" });
    expect(htmlGuest).not.toContain("Member content");
  });

  it("should evaluate exists condition correctly", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "optionalField",
            operator: "exists",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Field exists" }],
            },
          ],
        },
      ],
    };
    const htmlWithField = await renderTipTapToHtml(doc, {
      optionalField: "value",
    });
    expect(htmlWithField).toContain("Field exists");

    const htmlWithoutField = await renderTipTapToHtml(doc, {});
    expect(htmlWithoutField).not.toContain("Field exists");
  });

  it("should evaluate notExists condition correctly", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "missingField",
            operator: "notExists",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Field missing" }],
            },
          ],
        },
      ],
    };
    const htmlWithoutField = await renderTipTapToHtml(doc, {});
    expect(htmlWithoutField).toContain("Field missing");

    const htmlWithField = await renderTipTapToHtml(doc, {
      missingField: "exists",
    });
    expect(htmlWithField).not.toContain("Field missing");
  });

  it("should evaluate contains condition correctly", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "email",
            operator: "contains",
            value: "@gmail",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Gmail user" }],
            },
          ],
        },
      ],
    };
    const htmlGmail = await renderTipTapToHtml(doc, {
      email: "user@gmail.com",
    });
    expect(htmlGmail).toContain("Gmail user");

    const htmlOther = await renderTipTapToHtml(doc, {
      email: "user@yahoo.com",
    });
    expect(htmlOther).not.toContain("Gmail user");
  });

  it("should evaluate greaterThan condition correctly", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "count",
            operator: "greaterThan",
            value: 5,
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "High count" }],
            },
          ],
        },
      ],
    };
    const htmlHighCount = await renderTipTapToHtml(doc, { count: 10 });
    expect(htmlHighCount).toContain("High count");

    const htmlLowCount = await renderTipTapToHtml(doc, { count: 3 });
    expect(htmlLowCount).not.toContain("High count");
  });

  it("should evaluate lessThan condition correctly", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "price",
            operator: "lessThan",
            value: 100,
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Affordable" }],
            },
          ],
        },
      ],
    };
    const htmlLowPrice = await renderTipTapToHtml(doc, { price: 50 });
    expect(htmlLowPrice).toContain("Affordable");

    const htmlHighPrice = await renderTipTapToHtml(doc, { price: 200 });
    expect(htmlHighPrice).not.toContain("Affordable");
  });

  it("should return false for unknown operator", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "conditional",
          attrs: {
            variableName: "test",
            operator: "unknownOperator",
            value: "test",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Should not appear" }],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc, { test: "test" });
    expect(html).not.toContain("Should not appear");
  });
});

describe("nodeToReactEmail - Extended Coverage", () => {
  it("should render emailAvatar with default settings", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailAvatar",
          attrs: {
            src: "https://example.com/avatar.png",
            alt: "User",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("avatar");
  });

  it("should render emailAvatar with custom shape", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailAvatar",
          attrs: {
            src: "https://example.com/avatar.png",
            size: 100,
            shape: "rounded",
            align: "left",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("100");
  });

  it("should render emailCodeBlock", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailCodeBlock",
          attrs: {
            code: "const x = 1;",
            backgroundColor: "#282c34",
            textColor: "#abb2bf",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("const x = 1;");
    expect(html).toContain("#282c34");
  });

  it("should render emailSocialLinks with icons", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSocialLinks",
          attrs: {
            links: [
              { platform: "twitter", url: "https://twitter.com/test" },
              { platform: "github", url: "https://github.com/test" },
            ],
            iconSize: 32,
            iconColor: "#1da1f2",
            style: "icons",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("twitter.com/test");
    expect(html).toContain("github.com/test");
  });

  it("should render emailSocialLinks with text", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSocialLinks",
          attrs: {
            links: [
              { platform: "linkedin", url: "https://linkedin.com/in/test" },
            ],
            style: "text",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("LinkedIn");
  });

  it("should render emailSocialLinks with both icons and text", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSocialLinks",
          attrs: {
            links: [{ platform: "facebook", url: "https://facebook.com/test" }],
            style: "both",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("facebook.com/test");
    expect(html).toContain("Facebook");
  });

  it("should render empty emailSocialLinks as null", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSocialLinks",
          attrs: {
            links: [],
          },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "After social links" }],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("After social links");
  });

  it("should render emailPreview as hidden element", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailPreview",
          attrs: {
            text: "Preview text here",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("hidden");
  });

  it("should render codeBlock", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          content: [
            {
              type: "text",
              text: "function test() {}",
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("function test() {}");
    expect(html).toContain("<code>");
  });

  it("should render horizontalRule", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [{ type: "horizontalRule" }],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("<hr");
  });

  it("should render emailRow with columns", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailRow",
          attrs: { gap: "16px" },
          content: [
            {
              type: "emailColumn",
              attrs: {
                width: "50%",
                padding: "8px",
                verticalAlign: "middle",
                backgroundColor: "#f0f0f0",
              },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Left column" }],
                },
              ],
            },
            {
              type: "emailColumn",
              attrs: {
                width: "50%",
                verticalAlign: "bottom",
              },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Right column" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Left column");
    expect(html).toContain("Right column");
  });

  it("should render text with multiple marks", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Styled text",
              marks: [
                { type: "bold" },
                { type: "italic" },
                { type: "underline" },
                { type: "strike" },
              ],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Styled text");
  });

  it("should render text with link mark", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Click here",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("https://example.com");
    expect(html).toContain("Click here");
  });

  it("should render text with highlight mark", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Highlighted",
              marks: [{ type: "highlight", attrs: { color: "#ffff00" } }],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Highlighted");
  });

  it("should render text with textStyle mark", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Custom styled",
              marks: [
                {
                  type: "textStyle",
                  attrs: { color: "#ff0000", fontSize: "20px" },
                },
              ],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Custom styled");
  });

  it("should render emailSection with all styling", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailSection",
          attrs: {
            backgroundColor: "#f0f0f0",
            padding: "40px",
            borderRadius: "16px",
            maxWidth: "500px",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section content" }],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Section content");
  });

  it("should render emailImage with href", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailImage",
          attrs: {
            src: "https://example.com/image.png",
            alt: "Clickable",
            href: "https://example.com/page",
            borderRadius: "8px",
            objectFit: "cover",
            align: "right",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("example.com/page");
    expect(html).toContain("example.com/image.png");
  });

  it("should render emailButton with all border radius options", async () => {
    const radiusOptions = ["0px", "4px", "6px", "8px", "9999px"];
    for (const radius of radiusOptions) {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "emailButton",
            attrs: {
              href: "#",
              borderRadius: radius,
            },
            content: [{ type: "text", text: "Button" }],
          },
        ],
      };
      const html = await renderTipTapToHtml(doc);
      expect(html).toContain("Button");
    }
  });

  it("should render emailButton with text fallback", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "emailButton",
          attrs: {
            href: "#",
            text: "Fallback text",
          },
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Fallback text");
  });

  it("should handle unknown node with children", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "unknownType",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Child content" }],
            },
          ],
        },
      ],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toContain("Child content");
  });

  it("should handle unknown node without children", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [{ type: "unknownType" }],
    };
    const html = await renderTipTapToHtml(doc);
    expect(html).toBeDefined();
  });
});
