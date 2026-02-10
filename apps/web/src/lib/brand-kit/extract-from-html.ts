import type { ExtractedBrandKit } from "./extractor";
import { normalizeColor } from "./extractor";

/**
 * Default/placeholder colors used in react-email templates.
 * These should be filtered out when extracting brand colors,
 * as they represent our template defaults, not the user's brand.
 */
const TEMPLATE_DEFAULT_COLORS = new Set([
  "#5046e5",
  "#e0e7ff",
  "#3b82f6",
  "#dbeafe",
  "#6366f1",
  "#ffffff",
  "#f9fafb",
  "#f8fafc",
  "#1f2937",
  "#6b7280",
  "#9ca3af",
  "#e5e7eb",
  "#000000",
]);

type ExtractedBrandKitFromHtml = ExtractedBrandKit & {
  headingFontFamily: string | null;
  buttonStyle: string;
  buttonRadius: string;
};

/**
 * Extract brand kit values from compiled HTML of a react-email template.
 * Parses inline styles to find colors, fonts, logos, and button styles.
 */
export function extractBrandKitFromHtml(
  html: string,
  templateName: string
): ExtractedBrandKitFromHtml {
  const colorFrequency = new Map<string, number>();
  const fontFrequency = new Map<string, number>();
  const borderRadiusValues: string[] = [];

  // Extract all inline style attributes
  const styleRegex = /style="([^"]*)"/gi;
  for (const match of html.matchAll(styleRegex)) {
    const styleStr = match[1];
    extractColorsFromStyle(styleStr, colorFrequency);
    extractFontsFromStyle(styleStr, fontFrequency);
    extractBorderRadiusFromStyle(styleStr, borderRadiusValues);
  }

  // Also extract from <style> tags
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  for (const match of html.matchAll(styleTagRegex)) {
    const cssContent = match[1];
    // Parse property declarations from CSS rules
    const declarationRegex =
      /(?:color|background-color|background)\s*:\s*([^;}\n]+)/gi;
    for (const declMatch of cssContent.matchAll(declarationRegex)) {
      const value = declMatch[1].trim();
      const normalized = normalizeColor(value);
      if (normalized) {
        colorFrequency.set(
          normalized,
          (colorFrequency.get(normalized) || 0) + 1
        );
      }
    }
    const fontDeclRegex = /font-family\s*:\s*([^;}\n]+)/gi;
    for (const fontMatch of cssContent.matchAll(fontDeclRegex)) {
      const font = fontMatch[1].trim();
      if (font && !font.startsWith("var(")) {
        fontFrequency.set(font, (fontFrequency.get(font) || 0) + 1);
      }
    }
  }

  // Filter out template default colors
  for (const defaultColor of TEMPLATE_DEFAULT_COLORS) {
    colorFrequency.delete(defaultColor);
  }

  // Classify colors by HSL lightness
  const colors = classifyColors(colorFrequency);

  // Get most frequent non-default font
  const fontFamily = getMostFrequent(fontFrequency) || "system-ui, sans-serif";

  // Extract first <img> as logo
  const logoUrl = extractFirstImage(html);

  // Determine button style from border-radius
  const { buttonStyle, buttonRadius } =
    determineBuuttonStyle(borderRadiusValues);

  return {
    logoUrl,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    backgroundColor: colors.background,
    textColor: colors.text,
    fontFamily,
    headingFontFamily: null,
    companyName: null,
    sourceDomain: "",
    buttonStyle,
    buttonRadius,
  };
}

function extractColorsFromStyle(
  styleStr: string,
  frequency: Map<string, number>
): void {
  // Match color and background-color properties
  const colorRegex =
    /(?:^|;)\s*(?:color|background-color|background)\s*:\s*([^;!]+)/gi;
  for (const match of styleStr.matchAll(colorRegex)) {
    const value = match[1].trim();
    const normalized = normalizeColor(value);
    if (normalized) {
      frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
    }
  }
}

function extractFontsFromStyle(
  styleStr: string,
  frequency: Map<string, number>
): void {
  const fontRegex = /(?:^|;)\s*font-family\s*:\s*([^;!]+)/gi;
  for (const match of styleStr.matchAll(fontRegex)) {
    const font = match[1].trim();
    if (font && !font.startsWith("var(")) {
      frequency.set(font, (frequency.get(font) || 0) + 1);
    }
  }
}

function extractBorderRadiusFromStyle(
  styleStr: string,
  values: string[]
): void {
  const radiusRegex = /(?:^|;)\s*border-radius\s*:\s*([^;!]+)/gi;
  for (const match of styleStr.matchAll(radiusRegex)) {
    values.push(match[1].trim());
  }
}

function extractFirstImage(html: string): string | null {
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  for (const match of html.matchAll(imgRegex)) {
    const src = match[1];
    // Only return absolute URLs (skip data URIs and relative paths)
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }
  }
  return null;
}

/**
 * Convert hex color to HSL lightness value (0-1)
 */
function hexToLightness(hex: string): number {
  const color = hex.replace("#", "");
  const r = Number.parseInt(color.substring(0, 2), 16) / 255;
  const g = Number.parseInt(color.substring(2, 4), 16) / 255;
  const b = Number.parseInt(color.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max + min) / 2;
}

/**
 * Check if a color is chromatic (has meaningful saturation)
 */
function isChromatic(hex: string): boolean {
  const color = hex.replace("#", "");
  const r = Number.parseInt(color.substring(0, 2), 16) / 255;
  const g = Number.parseInt(color.substring(2, 4), 16) / 255;
  const b = Number.parseInt(color.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return false; // achromatic
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  return s > 0.1;
}

function classifyColors(frequency: Map<string, number>): {
  primary: string;
  secondary: string;
  background: string;
  text: string;
} {
  if (frequency.size === 0) {
    return {
      primary: "#5046e5",
      secondary: "#6366f1",
      background: "#ffffff",
      text: "#1f2937",
    };
  }

  let background: string | null = null;
  let text: string | null = null;
  const chromaticColors: Array<{ color: string; count: number }> = [];
  const darkColors: Array<{ color: string; count: number }> = [];
  const lightColors: Array<{ color: string; count: number }> = [];

  for (const [color, count] of frequency) {
    const lightness = hexToLightness(color);

    if (lightness > 0.9) {
      lightColors.push({ color, count });
    } else if (lightness < 0.2) {
      darkColors.push({ color, count });
    } else if (isChromatic(color)) {
      chromaticColors.push({ color, count });
    } else {
      // Neutral mid-range colors
      darkColors.push({ color, count });
    }
  }

  // Background: highest frequency light color
  if (lightColors.length > 0) {
    lightColors.sort((a, b) => b.count - a.count);
    background = lightColors[0].color;
  }

  // Text: highest frequency dark color
  if (darkColors.length > 0) {
    darkColors.sort((a, b) => b.count - a.count);
    text = darkColors[0].color;
  }

  // Primary/secondary: chromatic colors sorted by frequency
  chromaticColors.sort((a, b) => b.count - a.count);
  const primary = chromaticColors[0]?.color || null;
  const secondary = chromaticColors[1]?.color || null;

  return {
    primary: primary || "#5046e5",
    secondary: secondary || adjustColor(primary || "#5046e5", 15),
    background: background || "#ffffff",
    text: text || "#1f2937",
  };
}

function determineBuuttonStyle(borderRadiusValues: string[]): {
  buttonStyle: string;
  buttonRadius: string;
} {
  if (borderRadiusValues.length === 0) {
    return { buttonStyle: "rounded", buttonRadius: "4px" };
  }

  // Count frequency of each border-radius value
  const freq = new Map<string, number>();
  for (const v of borderRadiusValues) {
    // Normalize: take the first value if shorthand (e.g., "4px 4px 4px 4px" → "4px")
    const first = v.split(/\s+/)[0];
    freq.set(first, (freq.get(first) || 0) + 1);
  }

  // Find most common
  let mostCommon = "4px";
  let maxCount = 0;
  for (const [value, count] of freq) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = value;
    }
  }

  // Classify
  const numericValue = Number.parseFloat(mostCommon);
  if (numericValue === 0 || mostCommon === "0") {
    return { buttonStyle: "square", buttonRadius: "0px" };
  }
  if (numericValue >= 999 || mostCommon === "9999px") {
    return { buttonStyle: "pill", buttonRadius: "9999px" };
  }
  return { buttonStyle: "rounded", buttonRadius: mostCommon };
}

function adjustColor(hex: string, percent: number): string {
  const fullHex =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;

  const num = Number.parseInt(fullHex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);

  // biome-ignore lint/suspicious/noBitwiseOperators: Standard RGB color manipulation
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  // biome-ignore lint/suspicious/noBitwiseOperators: Standard RGB color manipulation
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00_ff) + amt));
  // biome-ignore lint/suspicious/noBitwiseOperators: Standard RGB color manipulation
  const B = Math.max(0, Math.min(255, (num & 0x00_00_ff) + amt));

  // biome-ignore lint/suspicious/noBitwiseOperators: Standard RGB color manipulation
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

function getMostFrequent(map: Map<string, number>): string | null {
  let best: string | null = null;
  let maxCount = 0;
  for (const [value, count] of map) {
    if (count > maxCount) {
      maxCount = count;
      best = value;
    }
  }
  return best;
}
