import type { PreferenceCenterTheme } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { themeToScopedCss } from "../serialize";

function makeTheme(
  overrides: Partial<PreferenceCenterTheme> = {}
): PreferenceCenterTheme {
  return {
    version: 1,
    light: { primary: "oklch(0.5 0.1 20)" },
    dark: { primary: "oklch(0.9 0.1 20)" },
    fonts: { body: null, heading: null },
    colorScheme: "system",
    ...overrides,
  };
}

describe("themeToScopedCss", () => {
  it("emits both the base and .dark-prefixed block for colorScheme: system", () => {
    const css = themeToScopedCss(makeTheme(), '[data-wraps-theme="pc"]');
    expect(css).toContain(
      '[data-wraps-theme="pc"] { --primary: oklch(0.5 0.1 20); }'
    );
    expect(css).toContain(
      '.dark [data-wraps-theme="pc"] { --primary: oklch(0.9 0.1 20); }'
    );
  });

  it("emits no .dark block for colorScheme: light", () => {
    const css = themeToScopedCss(
      makeTheme({ colorScheme: "light" }),
      '[data-wraps-theme="pc"]'
    );
    expect(css).toContain(
      '[data-wraps-theme="pc"] { --primary: oklch(0.5 0.1 20); }'
    );
    expect(css).not.toContain(".dark");
  });

  it("emits dark tokens under the base selector for colorScheme: dark, no .dark block", () => {
    const css = themeToScopedCss(
      makeTheme({ colorScheme: "dark" }),
      '[data-wraps-theme="pc"]'
    );
    expect(css).toBe(
      '[data-wraps-theme="pc"] { --primary: oklch(0.9 0.1 20); }'
    );
    expect(css).not.toContain(".dark");
  });

  it("drops a hostile value from a tampered DB row and emits no injected body", () => {
    const theme = makeTheme({
      light: { primary: "red; } body {" },
      dark: {},
    });
    const css = themeToScopedCss(theme, '[data-wraps-theme="pc"]');
    expect(css).toBe("");
    expect(css).not.toContain("}");
    expect(css).not.toContain("body");
  });

  it("serializes an empty theme to an empty string", () => {
    const theme = makeTheme({ light: {}, dark: {} });
    expect(themeToScopedCss(theme, '[data-wraps-theme="pc"]')).toBe("");
  });

  it("throws when the scope selector contains a brace", () => {
    expect(() => themeToScopedCss(makeTheme(), "[data-x]{evil}")).toThrow();
  });
});
