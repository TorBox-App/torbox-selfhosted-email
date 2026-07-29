import { describe, expect, it } from "vitest";
import { parseThemeCss } from "../parse";

const REPO_ROOT_CSS = `
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
  --success: oklch(0.59 0.2 145);
  --success-foreground: oklch(0.985 0 0);
  --warning: oklch(0.75 0.18 55);
  --warning-foreground: oklch(0.205 0 0);
  --info: oklch(0.62 0.15 250);
  --info-foreground: oklch(0.985 0 0);
  --color-1: oklch(66.2% 0.225 25.9);
  --color-2: oklch(60.4% 0.26 302);
  --color-3: oklch(69.6% 0.165 251);
  --color-4: oklch(80.2% 0.134 225);
  --color-5: oklch(90.7% 0.231 133);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
  --success: oklch(0.65 0.2 145);
  --success-foreground: oklch(0.985 0 0);
  --warning: oklch(0.8 0.18 55);
  --warning-foreground: oklch(0.205 0 0);
  --info: oklch(0.68 0.15 250);
  --info-foreground: oklch(0.985 0 0);
  --color-1: oklch(66.2% 0.225 25.9);
  --color-2: oklch(60.4% 0.26 302);
  --color-3: oklch(69.6% 0.165 251);
  --color-4: oklch(80.2% 0.134 225);
  --color-5: oklch(90.7% 0.231 133);
}
`;

describe("parseThemeCss", () => {
  it("parses the repo's own :root and .dark blocks into light/dark maps", () => {
    const { theme, warnings } = parseThemeCss(REPO_ROOT_CSS);

    // Allow-listed tokens that ARE present in the fixture.
    expect(theme.light.background).toBe("oklch(1 0 0)");
    expect(theme.light.primary).toBe("oklch(0.205 0 0)");
    expect(theme.light.radius).toBe("0.625rem");
    expect(theme.light.success).toBe("oklch(0.59 0.2 145)");
    expect(theme.light.warning).toBe("oklch(0.75 0.18 55)");

    expect(theme.dark.background).toBe("oklch(0.145 0 0)");
    expect(theme.dark.primary).toBe("oklch(0.922 0 0)");
    expect(theme.dark.border).toBe("oklch(1 0 0 / 10%)");

    // Only allow-listed tokens survive — sidebar/chart/info/color-N are not
    // in THEME_TOKENS and must be dropped with a warning each.
    expect(theme.light["sidebar-primary"]).toBeUndefined();
    expect(theme.light["chart-3"]).toBeUndefined();
    expect(theme.light.info).toBeUndefined();
    expect(theme.light["color-1"]).toBeUndefined();

    expect(warnings.some((w) => w.includes("--sidebar-primary"))).toBe(true);
    expect(warnings.some((w) => w.includes("--chart-3"))).toBe(true);
  });

  it("drops --sidebar-primary, --chart-3, --shadow-lg, --tracking-normal with a named warning each", () => {
    const css = `:root {
      --sidebar-primary: oklch(0.5 0 0);
      --chart-3: oklch(0.5 0 0);
      --shadow-lg: 0 1px 2px rgba(0,0,0,0.1);
      --tracking-normal: 0em;
    }`;
    const { theme, warnings } = parseThemeCss(css);

    expect(theme.light).toEqual({});
    expect(warnings.some((w) => w.includes("--sidebar-primary"))).toBe(true);
    expect(warnings.some((w) => w.includes("--chart-3"))).toBe(true);
    expect(warnings.some((w) => w.includes("--shadow-lg"))).toBe(true);
    expect(warnings.some((w) => w.includes("--tracking-normal"))).toBe(true);
  });

  it("normalizes a legacy bare HSL triple to hsl()", () => {
    const css = `:root { --background: 0 0% 100%; }`;
    const { theme } = parseThemeCss(css);
    expect(theme.light.background).toBe("hsl(0 0% 100%)");
  });

  it("rejects a declaration that tries to escape its block with a semicolon and brace", () => {
    const css = `:root {
      --primary: red; } body { display: none } .x {
    }`;
    const { theme } = parseThemeCss(css);
    expect(theme.light.primary).toBeUndefined();
  });

  it("rejects url() values", () => {
    const css = `:root { --primary: url(https://evil.example/x.png); }`;
    const { theme } = parseThemeCss(css);
    expect(theme.light.primary).toBeUndefined();
  });

  it("rejects var() chaining", () => {
    const css = `:root { --background: var(--some-other-thing); }`;
    const { theme } = parseThemeCss(css);
    expect(theme.light.background).toBeUndefined();
  });

  it("rejects !important trailers and angle-bracket injection", () => {
    const css = `:root {
      --primary: oklch(0.5 0.1 20) !important;
      --foreground: <script>;
    }`;
    const { theme } = parseThemeCss(css);
    expect(theme.light.primary).toBeUndefined();
    expect(theme.light.foreground).toBeUndefined();
  });

  it("rejects an oversized value (over 64 chars)", () => {
    const longValue = `oklch(${"0".repeat(60)} 0 0)`;
    const css = `:root { --primary: ${longValue}; }`;
    const { theme } = parseThemeCss(css);
    expect(theme.light.primary).toBeUndefined();
  });

  it("ignores a stylesheet containing @import url(...)", () => {
    const css = `@import url("https://evil.example/x.css");\n:root { --primary: oklch(0.5 0.1 20); }`;
    const { theme } = parseThemeCss(css);
    expect(theme.light.primary).toBe("oklch(0.5 0.1 20)");
  });

  it("returns empty maps for garbage input without throwing", () => {
    expect(() => parseThemeCss("not css at all")).not.toThrow();
    expect(parseThemeCss("not css at all").theme).toEqual({
      light: {},
      dark: {},
    });
    expect(parseThemeCss("").theme).toEqual({ light: {}, dark: {} });
  });

  it("rejects a 200 KB input via the size cap without throwing", () => {
    const huge = `:root { --primary: oklch(0.5 0.1 20); }`.repeat(5000);
    expect(() => parseThemeCss(huge)).not.toThrow();
    const { theme, warnings } = parseThemeCss(huge);
    expect(theme.light).toEqual({});
    expect(warnings.some((w) => w.includes("too large"))).toBe(true);
  });
});
