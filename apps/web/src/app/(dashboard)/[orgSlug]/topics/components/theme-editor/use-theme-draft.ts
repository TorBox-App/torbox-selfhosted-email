"use client";

import type { PreferenceCenterTheme } from "@wraps/db";
import { useMemo, useState } from "react";
// Type-only: fonts.ts calls next/font/google at module scope, which only
// works inside a Next build/test transform. A type-only import is erased at
// compile time, so this module (and its pure helpers below) stay usable in
// plain Vitest — same pattern as apps/web/src/lib/preference-theme/validate.ts.
import type { PreferenceFontId } from "@/lib/preference-theme/fonts";
import { buildThemeFromAccent } from "@/lib/preference-theme/ramp";
import type { ThemeToken } from "@/lib/preference-theme/tokens";
import {
  isValidColorValue,
  isValidRadiusValue,
} from "@/lib/preference-theme/validate";

export type ThemeDraft = PreferenceCenterTheme;

/** Which map a per-token write lands in. The toolbar passes the currently
 *  PREVIEWED mode, not the published colorScheme — the published scheme
 *  governs what ships, never what's editable. */
export type ThemeMode = "light" | "dark" | "both";

// Mirrors fonts.ts's DEFAULT_BODY_FONT_ID as a literal (not imported at
// runtime) for the same reason validate.ts hand-maintains KNOWN_FONT_IDS.
const DEFAULT_BODY_FONT_ID: PreferenceFontId = "inter";

function isPlainRecordEqual(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => a[key] === b[key]);
}

/** Structural equality for a PreferenceCenterTheme — used to derive isDirty. */
export function isThemeEqual(
  a: PreferenceCenterTheme,
  b: PreferenceCenterTheme
): boolean {
  return (
    a.version === b.version &&
    a.colorScheme === b.colorScheme &&
    a.fonts.body === b.fonts.body &&
    a.fonts.heading === b.fonts.heading &&
    isPlainRecordEqual(a.light, b.light) &&
    isPlainRecordEqual(a.dark, b.dark)
  );
}

/**
 * Pure state transitions, extracted from the hook so they can be unit
 * tested directly (see __tests__/use-theme-draft.test.ts) without a DOM or
 * React. Every write here runs the same validators plan 153's parser and
 * serializer use, before the server ever sees the value — the server's
 * sanitizeTheme re-validates anyway, but keeping the client honest means the
 * preview can never show something the server would refuse to save.
 */

/** Rebuilds BOTH ramps via buildThemeFromAccent. Mode-independent by design —
 * one accent, two coherent modes. Invalid values leave the draft unchanged. */
export function applyAccent(draft: ThemeDraft, accent: string): ThemeDraft {
  if (!isValidColorValue(accent)) {
    return draft;
  }
  return buildThemeFromAccent(accent, draft);
}

/** Writes a single token into light, dark, or both — the published
 * colorScheme never gates which map is editable. Invalid values are
 * dropped silently. */
export function applyToken(
  draft: ThemeDraft,
  mode: ThemeMode,
  token: ThemeToken,
  value: string
): ThemeDraft {
  const isRadius = token === "radius";
  const isValid = isRadius
    ? isValidRadiusValue(value)
    : isValidColorValue(value);
  if (!isValid) {
    return draft;
  }

  const next: ThemeDraft = { ...draft };
  if (mode === "light" || mode === "both") {
    next.light = { ...draft.light, [token]: value };
  }
  if (mode === "dark" || mode === "both") {
    next.dark = { ...draft.dark, [token]: value };
  }
  return next;
}

/** Radius has no per-mode meaning — always writes both maps. */
export function applyRadius(draft: ThemeDraft, value: string): ThemeDraft {
  if (!isValidRadiusValue(value)) {
    return draft;
  }
  return {
    ...draft,
    light: { ...draft.light, radius: value },
    dark: { ...draft.dark, radius: value },
  };
}

export function applyFont(
  draft: ThemeDraft,
  slot: "body" | "heading",
  id: PreferenceFontId | null
): ThemeDraft {
  return { ...draft, fonts: { ...draft.fonts, [slot]: id } };
}

/** Persisted as fonts.heading === null (no schema change needed). Unlinking
 * seeds the heading picker with the current body font so it starts on a
 * real value instead of blank. */
export function applyFontsLinked(
  draft: ThemeDraft,
  linked: boolean
): ThemeDraft {
  if (linked) {
    return { ...draft, fonts: { ...draft.fonts, heading: null } };
  }
  const seed = draft.fonts.heading ?? draft.fonts.body ?? DEFAULT_BODY_FONT_ID;
  return { ...draft, fonts: { ...draft.fonts, heading: seed } };
}

export function applyColorScheme(
  draft: ThemeDraft,
  scheme: "light" | "dark" | "system"
): ThemeDraft {
  return { ...draft, colorScheme: scheme };
}

/** Replaces (does not merge) both maps — pasting a full globals.css is a
 * "this is my theme now" gesture. Merging would leave orphan tokens from the
 * previous accent and produce results nobody can explain. */
export function applyParsed(
  draft: ThemeDraft,
  parsed: { light: Record<string, string>; dark: Record<string, string> }
): ThemeDraft {
  return {
    ...draft,
    light: { ...parsed.light },
    dark: { ...parsed.dark },
  };
}

export type UseThemeDraftResult = {
  draft: ThemeDraft;
  isDirty: boolean;
  setAccent: (accent: string) => void;
  setToken: (mode: ThemeMode, token: ThemeToken, value: string) => void;
  setRadius: (value: string) => void;
  setFont: (slot: "body" | "heading", id: PreferenceFontId | null) => void;
  setFontsLinked: (linked: boolean) => void;
  setColorScheme: (scheme: "light" | "dark" | "system") => void;
  applyParsed: (parsed: {
    light: Record<string, string>;
    dark: Record<string, string>;
  }) => void;
  reset: () => void;
};

export function useThemeDraft(
  initial: PreferenceCenterTheme
): UseThemeDraftResult {
  const [draft, setDraft] = useState<ThemeDraft>(initial);

  const isDirty = useMemo(
    () => !isThemeEqual(draft, initial),
    [draft, initial]
  );

  return {
    draft,
    isDirty,
    setAccent: (accent) => setDraft((prev) => applyAccent(prev, accent)),
    setToken: (mode, token, value) =>
      setDraft((prev) => applyToken(prev, mode, token, value)),
    setRadius: (value) => setDraft((prev) => applyRadius(prev, value)),
    setFont: (slot, id) => setDraft((prev) => applyFont(prev, slot, id)),
    setFontsLinked: (linked) =>
      setDraft((prev) => applyFontsLinked(prev, linked)),
    setColorScheme: (scheme) =>
      setDraft((prev) => applyColorScheme(prev, scheme)),
    applyParsed: (parsed) => setDraft((prev) => applyParsed(prev, parsed)),
    reset: () => setDraft(initial),
  };
}
