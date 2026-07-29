import type { PreferenceCenterTheme } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCE_THEME } from "@/lib/preference-theme/resolve";
import {
  applyAccent,
  applyFont,
  applyFontsLinked,
  applyParsed,
  applyRadius,
  applyToken,
  isThemeEqual,
} from "../use-theme-draft";

function makeDraft(
  overrides: Partial<PreferenceCenterTheme> = {}
): PreferenceCenterTheme {
  return {
    version: 1,
    light: { background: "oklch(1 0 0)" },
    dark: { background: "oklch(0.145 0 0)" },
    fonts: { body: null, heading: null },
    colorScheme: "system",
    ...overrides,
  };
}

describe("applyAccent", () => {
  it("leaves the draft unchanged for an invalid value", () => {
    const draft = makeDraft();
    expect(applyAccent(draft, "javascript:alert(1)")).toBe(draft);
    expect(applyAccent(draft, "url(x)")).toBe(draft);
  });

  it("rewrites both maps — mode-independent by design", () => {
    const draft = makeDraft();
    const next = applyAccent(draft, "#4f46e5");
    expect(next.light.primary).toBe("#4f46e5");
    expect(next.dark.primary).toBe("#4f46e5");
    expect(Object.keys(next.light).length).toBeGreaterThan(1);
    expect(Object.keys(next.dark).length).toBeGreaterThan(1);
  });
});

describe("applyToken — mode routing", () => {
  it("a 'dark' write changes dark.background and leaves light.background untouched", () => {
    const draft = makeDraft();
    const next = applyToken(draft, "dark", "background", "oklch(0.3 0 0)");
    expect(next.dark.background).toBe("oklch(0.3 0 0)");
    expect(next.light.background).toBe(draft.light.background);
  });

  it("a 'light' write changes light.background and leaves dark.background untouched", () => {
    const draft = makeDraft();
    const next = applyToken(draft, "light", "background", "oklch(0.9 0 0)");
    expect(next.light.background).toBe("oklch(0.9 0 0)");
    expect(next.dark.background).toBe(draft.dark.background);
  });

  it("a write to the dark map still lands when the published colorScheme is 'light' — editing is not gated by the published scheme", () => {
    const draft = makeDraft({ colorScheme: "light" });
    const next = applyToken(draft, "dark", "background", "oklch(0.3 0 0)");
    expect(next.dark.background).toBe("oklch(0.3 0 0)");
    expect(next.colorScheme).toBe("light");
  });

  it("'both' writes land in both maps", () => {
    const draft = makeDraft();
    const next = applyToken(draft, "both", "border", "#123456");
    expect(next.light.border).toBe("#123456");
    expect(next.dark.border).toBe("#123456");
  });

  it("drops an invalid value silently", () => {
    const draft = makeDraft();
    expect(applyToken(draft, "light", "background", "url(x)")).toBe(draft);
  });
});

describe("applyRadius", () => {
  it("writes radius into both maps", () => {
    const draft = makeDraft();
    const next = applyRadius(draft, "0.875rem");
    expect(next.light.radius).toBe("0.875rem");
    expect(next.dark.radius).toBe("0.875rem");
  });

  it("drops an invalid radius silently", () => {
    const draft = makeDraft();
    expect(applyRadius(draft, "not-a-radius")).toBe(draft);
  });
});

describe("applyFont / applyFontsLinked", () => {
  it("setFont('heading', null) is how 'linked' is represented", () => {
    const draft = makeDraft({ fonts: { body: "inter", heading: "lora" } });
    const next = applyFont(draft, "heading", null);
    expect(next.fonts.heading).toBeNull();
  });

  it("applyFontsLinked(true) sets heading to null", () => {
    const draft = makeDraft({ fonts: { body: "inter", heading: "lora" } });
    const next = applyFontsLinked(draft, true);
    expect(next.fonts.heading).toBeNull();
    expect(next.fonts.body).toBe("inter");
  });

  it("applyFontsLinked(false) seeds heading with the current body font", () => {
    const draft = makeDraft({ fonts: { body: "manrope", heading: null } });
    const next = applyFontsLinked(draft, false);
    expect(next.fonts.heading).toBe("manrope");
  });
});

describe("applyParsed", () => {
  it("replaces rather than merges — a token absent from the parsed payload disappears", () => {
    const draft = makeDraft({
      light: { accent: "red", background: "oklch(1 0 0)" },
      dark: { accent: "red" },
    });
    const next = applyParsed(draft, {
      light: { primary: "#4f46e5" },
      dark: {},
    });
    expect(next.light).toEqual({ primary: "#4f46e5" });
    expect(next.light.accent).toBeUndefined();
    expect(next.dark).toEqual({});
  });
});

describe("isThemeEqual (isDirty basis)", () => {
  it("DEFAULT_PREFERENCE_THEME equals itself", () => {
    expect(
      isThemeEqual(DEFAULT_PREFERENCE_THEME, DEFAULT_PREFERENCE_THEME)
    ).toBe(true);
  });

  it("a theme mutated via applyAccent from DEFAULT_PREFERENCE_THEME no longer equals it — this is the reset target", () => {
    const mutated = applyAccent(DEFAULT_PREFERENCE_THEME, "#4f46e5");
    expect(isThemeEqual(mutated, DEFAULT_PREFERENCE_THEME)).toBe(false);
    // "Discard"/reset re-points the draft back at the original reference,
    // which by definition equals itself again.
    expect(
      isThemeEqual(DEFAULT_PREFERENCE_THEME, DEFAULT_PREFERENCE_THEME)
    ).toBe(true);
  });
});
