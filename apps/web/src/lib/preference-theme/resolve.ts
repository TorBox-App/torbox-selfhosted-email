import type { PreferenceCenterTheme } from "@wraps/db";
import { isValidColorValue } from "./validate";

export const DEFAULT_PREFERENCE_THEME: PreferenceCenterTheme = {
  version: 1,
  light: {},
  dark: {},
  fonts: { body: null, heading: null },
  colorScheme: "system",
};

/**
 * Resolve the theme to actually render for a preference center page.
 *
 * Back-compat rule — this is what keeps the page visually identical to
 * today's hardcoded-brandColor rendering for every existing org (none of
 * which have a stored theme yet). When there's no `primary` set (either
 * because `theme` is null, or because it's set but doesn't touch `primary`),
 * fall back to `brandColor` for both light and dark `primary`, with a fixed
 * near-white `primary-foreground` — reproducing today's brand-colored
 * button/checkbox with white text.
 */
export function resolvePreferenceCenterTheme(input: {
  theme: PreferenceCenterTheme | null;
  brandColor: string | null;
}): PreferenceCenterTheme {
  const { theme, brandColor } = input;
  const base = theme ?? DEFAULT_PREFERENCE_THEME;

  const hasPrimary = "primary" in base.light || "primary" in base.dark;
  if (hasPrimary || !brandColor || !isValidColorValue(brandColor)) {
    return base;
  }

  return {
    ...base,
    light: {
      ...base.light,
      primary: brandColor,
      "primary-foreground": "oklch(0.985 0 0)",
    },
    dark: {
      ...base.dark,
      primary: brandColor,
      "primary-foreground": "oklch(0.985 0 0)",
    },
  };
}
