import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("neutralises a link injected through a user-controlled name", () => {
    const injected = '<a href="https://evil.example">Verify your account</a>';

    const escaped = escapeHtml(injected);

    // The whole point: this must not survive as markup in a Wraps-sent email.
    expect(escaped).not.toContain("<a");
    expect(escaped).not.toContain("</a>");
    expect(escaped).toContain("&lt;a");
  });

  it("escapes every character that can break out of an attribute or element", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("escapes the ampersand first so escapes are not double-encoded", () => {
    // A naive implementation that replaces & last turns "<" into "&amp;lt;".
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Spring Sale 2026")).toBe("Spring Sale 2026");
    expect(escapeHtml("")).toBe("");
  });
});
