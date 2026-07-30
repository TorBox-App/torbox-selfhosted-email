import type { PreferenceCenterTheme } from "@wraps/db";
import { themeToScopedCss } from "./serialize";
import { COLOR_TOKENS, type ThemeToken } from "./tokens";

/**
 * The pairs the contrast dialog reports, in display order. No sidebar, no
 * charts — this page doesn't render them — plus this repo's extra semantic
 * tokens (success/warning) alongside the standard shadcn set.
 */
export const CONTRAST_PAIRS: readonly {
  label: string;
  fg: ThemeToken;
  bg: ThemeToken;
}[] = [
  { label: "Primary", fg: "primary-foreground", bg: "primary" },
  { label: "Background", fg: "foreground", bg: "background" },
  {
    label: "Background / muted text",
    fg: "muted-foreground",
    bg: "background",
  },
  { label: "Card", fg: "card-foreground", bg: "card" },
  { label: "Popover", fg: "popover-foreground", bg: "popover" },
  { label: "Secondary", fg: "secondary-foreground", bg: "secondary" },
  { label: "Muted", fg: "muted-foreground", bg: "muted" },
  { label: "Accent", fg: "accent-foreground", bg: "accent" },
  { label: "Destructive", fg: "destructive-foreground", bg: "destructive" },
  { label: "Success", fg: "success-foreground", bg: "success" },
  { label: "Warning", fg: "warning-foreground", bg: "warning" },
];

const RGB_PATTERN =
  /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i;

function srgbToLinear(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.040_45
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/**
 * Resolve any CSS color string to sRGB via the browser (so oklch()/hsl()/hex
 * all work without hand-rolling a parser here), then compute the WCAG
 * contrast ratio against a second color. Client-only — guard callers on
 * `typeof window !== "undefined"`. Returns null if the computed color didn't
 * normalize to rgb(...)/rgba(...) (e.g. wide-gamut oklch resolving to
 * `color(display-p3 ...)` in some browsers) — a blank row beats a wrong ratio.
 */
export function contrastRatio(
  foreground: string,
  background: string,
  host: HTMLElement
): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fgLum = computeLuminance(foreground, host);
  const bgLum = computeLuminance(background, host);
  if (fgLum === null || bgLum === null) {
    return null;
  }

  const [hi, lo] = fgLum >= bgLum ? [fgLum, bgLum] : [bgLum, fgLum];
  return (hi + 0.05) / (lo + 0.05);
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Normalize any browser-supported CSS color to sRGB via a 1x1 canvas.
 * getComputedStyle no longer normalizes modern color functions — Chrome 111+
 * computes `color: oklch(...)` to the oklch string itself, not rgb() — but
 * canvas fillStyle accepts them and getImageData always reads back sRGB.
 * An invalid color leaves fillStyle unchanged, so priming with two different
 * sentinels detects it: only a valid color serializes identically both times.
 */
function colorToSrgb(color: string): [number, number, number] | null {
  if (measureCtx === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    measureCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!measureCtx) {
    return null;
  }
  measureCtx.fillStyle = "#000000";
  measureCtx.fillStyle = color;
  const first = measureCtx.fillStyle;
  measureCtx.fillStyle = "#ffffff";
  measureCtx.fillStyle = color;
  if (measureCtx.fillStyle !== first) {
    return null;
  }
  measureCtx.clearRect(0, 0, 1, 1);
  measureCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = measureCtx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function computeLuminance(color: string, host: HTMLElement): number | null {
  const span = document.createElement("span");
  span.style.color = color;
  span.style.display = "none";
  host.appendChild(span);
  const computed = getComputedStyle(span).color;
  host.removeChild(span);

  const match = computed.match(RGB_PATTERN);
  if (match) {
    const r = Number.parseInt(match[1], 10);
    const g = Number.parseInt(match[2], 10);
    const b = Number.parseInt(match[3], 10);
    return relativeLuminance(r, g, b);
  }

  const srgb = colorToSrgb(computed) ?? colorToSrgb(color);
  if (!srgb) {
    return null;
  }
  return relativeLuminance(srgb[0], srgb[1], srgb[2]);
}

export function wcagLevel(ratio: number): { aa: boolean; aaa: boolean } {
  return { aa: ratio >= 4.5, aaa: ratio >= 7 };
}

const MEASURE_SCOPE_ID = "pc-contrast-measure";

/**
 * Resolve every color token's EFFECTIVE value for one mode of a theme — the
 * draft's own override if set, or the app's own default (globals.css) if
 * not — by rendering a hidden, correctly-scoped probe element into the live
 * document and reading back getComputedStyle. This reuses the app's real
 * CSS cascade instead of hand-duplicating globals.css's defaults a third
 * time in JS (ramp.ts's NEUTRAL_RAMP is the first copy).
 *
 * The probe also carries the `.dark` class when mode is "dark", so unset
 * dark tokens fall through to the app's `.dark` defaults regardless of
 * whether the dashboard operator's OWN theme happens to be light or dark at
 * the moment they're editing — without this, an operator editing in a light
 * dashboard would see light-mode fallbacks leak into a "preview dark" check.
 * Client-only; returns {} outside the browser.
 */
export function resolveThemeTokens(
  theme: PreferenceCenterTheme,
  mode: "light" | "dark"
): Record<string, string> {
  if (typeof document === "undefined") {
    return {};
  }

  const probe = document.createElement("div");
  probe.setAttribute("data-wraps-theme", MEASURE_SCOPE_ID);
  if (mode === "dark") {
    probe.classList.add("dark");
  }
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";

  const styleEl = document.createElement("style");
  styleEl.textContent = themeToScopedCss(
    { ...theme, colorScheme: mode },
    `[data-wraps-theme="${MEASURE_SCOPE_ID}"]`
  );

  document.body.appendChild(styleEl);
  document.body.appendChild(probe);

  const computed = getComputedStyle(probe);
  const resolved: Record<string, string> = {};
  for (const token of COLOR_TOKENS) {
    const value = computed.getPropertyValue(`--${token}`).trim();
    if (value) {
      resolved[token] = value;
    }
  }

  document.body.removeChild(probe);
  document.body.removeChild(styleEl);

  return resolved;
}
