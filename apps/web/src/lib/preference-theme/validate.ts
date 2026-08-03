import type { PreferenceCenterTheme } from "@wraps/db";
import { z } from "zod";
// Type-only import: fonts.ts calls next/font/google at module scope (needed
// for Next's build-time font optimization), which only works inside a Next
// build/test transform. A type-only import is erased at compile time, so
// this module can validate font ids without pulling in that runtime import.
import type { PreferenceFontId } from "./fonts";
import { THEME_TOKEN_SET } from "./tokens";

const MAX_VALUE_LENGTH = 64;

// Substrings that are never allowed in a stored/emitted CSS custom property
// value, checked case-insensitively before any pattern matching. This is the
// hard-reject pass: it blocks CSS injection vectors (chaining to other
// variables, remote resource loads, statement termination, comments) before
// the grammar below ever runs.
const HARD_REJECT_SUBSTRINGS = [
  "url(",
  "var(",
  "\\",
  "<",
  ">",
  "{",
  "}",
  ";",
  "@",
  "/*",
  "*/",
  "expression(",
  "image(",
  "element(",
  "attr(",
];

const COLOR_FUNCTION_PATTERN =
  /^(oklch|oklab|lch|lab|hsl|hsla|rgb|rgba)\(\s*[0-9a-zA-Z.%/\s,+-]*\)$/;
const HEX_COLOR_PATTERN =
  /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NAMED_COLOR_VALUES = new Set([
  "transparent",
  "currentcolor",
  "white",
  "black",
]);

const RADIUS_PATTERN = /^(0|-?\d*\.?\d+(rem|px|em))$/;

const LEGACY_HSL_TRIPLE_PATTERN =
  /^-?[\d.]+\s+[\d.]+%\s+[\d.]+%(\s*\/\s*[\d.]+%?)?$/;

function passesHardReject(value: string): boolean {
  if (value.length > MAX_VALUE_LENGTH) {
    return false;
  }
  if (value.includes("\n") || value.includes("\r")) {
    return false;
  }
  const lower = value.toLowerCase();
  return HARD_REJECT_SUBSTRINGS.every((needle) => !lower.includes(needle));
}

export function isValidColorValue(value: string): boolean {
  if (!passesHardReject(value)) {
    return false;
  }
  if (NAMED_COLOR_VALUES.has(value.toLowerCase())) {
    return true;
  }
  return COLOR_FUNCTION_PATTERN.test(value) || HEX_COLOR_PATTERN.test(value);
}

export function isValidRadiusValue(value: string): boolean {
  if (!passesHardReject(value)) {
    return false;
  }
  return RADIUS_PATTERN.test(value);
}

/**
 * Legacy shadcn (pre-Tailwind-v4) themes stored bare HSL triples, e.g.
 * `--background: 0 0% 100%`, and wrapped them in hsl() at the theme layer.
 * This repo's @theme inline block does NOT wrap, so a bare triple would emit
 * an invalid color. Normalize it to a real hsl() call.
 */
export function normalizeLegacyHsl(value: string): string {
  if (LEGACY_HSL_TRIPLE_PATTERN.test(value)) {
    return `hsl(${value})`;
  }
  return value;
}

const ThemeShapeSchema = z.object({
  version: z.literal(1),
  light: z.record(z.string(), z.string()).optional().default({}),
  dark: z.record(z.string(), z.string()).optional().default({}),
  fonts: z
    .object({
      body: z.string().nullable().optional(),
      heading: z.string().nullable().optional(),
    })
    .optional()
    .default({ body: null, heading: null }),
  colorScheme: z.enum(["light", "dark", "system"]).optional().default("system"),
});

function sanitizeColorMap(map: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, rawValue] of Object.entries(map)) {
    if (!THEME_TOKEN_SET.has(name) || typeof rawValue !== "string") {
      continue;
    }
    const isRadius = name === "radius";
    const normalized = isRadius ? rawValue : normalizeLegacyHsl(rawValue);
    const isValid = isRadius
      ? isValidRadiusValue(normalized)
      : isValidColorValue(normalized);
    if (!isValid) {
      continue;
    }
    result[name] = normalized;
  }
  return result;
}

// Mirrors the ids in fonts.ts's PREFERENCE_FONTS. Declared as a
// Record<PreferenceFontId, true> (not imported at runtime) so TypeScript's
// excess/missing property checks force this list to stay exactly in sync
// with the PreferenceFontId union whenever a font is added or removed.
const KNOWN_FONT_IDS: Record<PreferenceFontId, true> = {
  inter: true,
  geist: true,
  "dm-sans": true,
  manrope: true,
  outfit: true,
  montserrat: true,
  poppins: true,
  "open-sans": true,
  roboto: true,
  "playfair-display": true,
  "source-serif-4": true,
  lora: true,
  merriweather: true,
  prata: true,
};

function sanitizeFontId(
  id: string | null | undefined
): PreferenceFontId | null {
  if (id && Object.hasOwn(KNOWN_FONT_IDS, id)) {
    return id as PreferenceFontId;
  }
  return null;
}

/**
 * Server-side validation for a theme object coming from the client before
 * it is ever persisted. Never trust client input: this re-validates the
 * outer shape (zod) and every token value (the same grammar used by the
 * parser/serializer), dropping anything that doesn't pass. Returns null for
 * anything that isn't a plausible theme object at all.
 */
export function sanitizeTheme(input: unknown): PreferenceCenterTheme | null {
  const parsed = ThemeShapeSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;

  return {
    version: 1,
    light: sanitizeColorMap(data.light),
    dark: sanitizeColorMap(data.dark),
    fonts: {
      body: sanitizeFontId(data.fonts.body),
      heading: sanitizeFontId(data.fonts.heading),
    },
    colorScheme: data.colorScheme,
  };
}

const MAX_LOGO_URL_LENGTH = 2048;

/**
 * Server-side validation for an operator-supplied logo URL before it is
 * persisted and later rendered as an <img src> on a public, unauthenticated
 * page. Only absolute https URLs are accepted — this rejects javascript:,
 * data:, and protocol-relative values, and keeps subscriber pages free of
 * mixed content. Returns null for anything that doesn't qualify.
 */
export function sanitizeLogoUrl(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_LOGO_URL_LENGTH) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
