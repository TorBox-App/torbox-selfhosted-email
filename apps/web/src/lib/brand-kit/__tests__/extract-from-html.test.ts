import { describe, expect, it } from "vitest";
import { extractBrandKitFromHtml } from "../extract-from-html";

describe("extractBrandKitFromHtml", () => {
  it("should extract primary color from most frequent inline color", () => {
    const html = `
      <html>
        <body>
          <div style="background-color: #e74c3c;">Header</div>
          <a style="color: #e74c3c;">Link 1</a>
          <a style="color: #e74c3c;">Link 2</a>
          <p style="color: #333333;">Text</p>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.primaryColor).toBe("#e74c3c");
  });

  it("should extract font-family from inline styles", () => {
    const html = `
      <html>
        <body style="font-family: 'Helvetica Neue', Arial, sans-serif;">
          <p style="font-family: 'Helvetica Neue', Arial, sans-serif;">Hello</p>
          <p style="font-family: 'Helvetica Neue', Arial, sans-serif;">World</p>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.fontFamily).toBe("'Helvetica Neue', Arial, sans-serif");
  });

  it("should extract first <img> src as logo", () => {
    const html = `
      <html>
        <body>
          <img src="https://example.com/logo.png" alt="Logo" />
          <img src="https://example.com/banner.png" alt="Banner" />
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.logoUrl).toBe("https://example.com/logo.png");
  });

  it("should ignore data URIs and relative paths for logo", () => {
    const html = `
      <html>
        <body>
          <img src="data:image/png;base64,abc123" alt="Inline" />
          <img src="/images/logo.png" alt="Relative" />
          <img src="https://example.com/actual-logo.png" alt="Logo" />
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.logoUrl).toBe("https://example.com/actual-logo.png");
  });

  it("should extract button border-radius", () => {
    const html = `
      <html>
        <body>
          <a style="border-radius: 8px; background-color: #e74c3c;">Button 1</a>
          <a style="border-radius: 8px; background-color: #e74c3c;">Button 2</a>
          <div style="border-radius: 4px;">Card</div>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.buttonRadius).toBe("8px");
    expect(result.buttonStyle).toBe("rounded");
  });

  it("should detect pill button style", () => {
    const html = `
      <html>
        <body>
          <a style="border-radius: 9999px; background-color: #e74c3c;">Button</a>
          <a style="border-radius: 9999px; background-color: #e74c3c;">Button 2</a>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.buttonStyle).toBe("pill");
    expect(result.buttonRadius).toBe("9999px");
  });

  it("should detect square button style", () => {
    const html = `
      <html>
        <body>
          <a style="border-radius: 0; background-color: #e74c3c;">Button</a>
          <a style="border-radius: 0; background-color: #e74c3c;">Button 2</a>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.buttonStyle).toBe("square");
  });

  it("should filter out DEFAULT_COLORS and return user's custom colors", () => {
    // These are template defaults that should be filtered out
    const html = `
      <html>
        <body>
          <div style="background-color: #5046e5;">Default primary</div>
          <div style="color: #1f2937;">Default text</div>
          <div style="background-color: #ffffff;">Default bg</div>
          <div style="color: #6366f1;">Default secondary</div>
          <a style="color: #2563eb;">Custom brand color</a>
          <a style="color: #2563eb;">Custom brand color again</a>
          <p style="color: #374151;">Custom text</p>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    // Should pick up the custom brand color, not the defaults
    expect(result.primaryColor).toBe("#2563eb");
  });

  it("should return defaults for HTML with no custom styling", () => {
    const html = `
      <html>
        <body>
          <p>Just plain text</p>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.primaryColor).toBe("#5046e5");
    expect(result.secondaryColor).toBe("#6366f1");
    expect(result.backgroundColor).toBe("#ffffff");
    expect(result.textColor).toBe("#1f2937");
    expect(result.fontFamily).toBe("system-ui, sans-serif");
    expect(result.logoUrl).toBeNull();
  });

  it("should return defaults for empty HTML", () => {
    const result = extractBrandKitFromHtml("", "Test Template");
    expect(result.primaryColor).toBe("#5046e5");
    expect(result.secondaryColor).toBe("#6366f1");
    expect(result.backgroundColor).toBe("#ffffff");
    expect(result.textColor).toBe("#1f2937");
    expect(result.fontFamily).toBe("system-ui, sans-serif");
    expect(result.logoUrl).toBeNull();
  });

  it("should classify colors by lightness", () => {
    const html = `
      <html>
        <body>
          <div style="background-color: #f5f5f5;">Light bg</div>
          <div style="background-color: #f5f5f5;">Light bg again</div>
          <p style="color: #111111;">Dark text</p>
          <p style="color: #111111;">Dark text again</p>
          <a style="color: #3498db;">Blue link</a>
          <a style="color: #3498db;">Blue link again</a>
          <a style="color: #e67e22;">Orange accent</a>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.backgroundColor).toBe("#f5f5f5");
    expect(result.textColor).toBe("#111111");
    // Primary should be the most frequent chromatic color
    expect(result.primaryColor).toBe("#3498db");
    expect(result.secondaryColor).toBe("#e67e22");
  });

  it("should handle RGB color values in inline styles", () => {
    const html = `
      <html>
        <body>
          <div style="background-color: rgb(52, 152, 219);">Blue</div>
          <div style="color: rgb(52, 152, 219);">Blue text</div>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.primaryColor).toBe("#3498db");
  });

  it("should extract colors from style tags", () => {
    const html = `
      <html>
        <head>
          <style>
            .header { background-color: #2ecc71; }
            .text { color: #2ecc71; }
          </style>
        </head>
        <body>
          <div class="header">Header</div>
          <p class="text">Text</p>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.primaryColor).toBe("#2ecc71");
  });

  it("should return null for headingFontFamily", () => {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <p>Hello</p>
        </body>
      </html>
    `;

    const result = extractBrandKitFromHtml(html, "Test Template");
    expect(result.headingFontFamily).toBeNull();
  });
});
