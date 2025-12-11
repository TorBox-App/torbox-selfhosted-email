import type { JSONContent } from "@tiptap/core";
import { PLACEHOLDER_IMAGES } from "./placeholders";

/**
 * Brand kit values that can be applied to content
 */
export type BrandKitValues = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  headingFontFamily?: string | null;
  buttonStyle?: string | null;
  buttonRadius?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
  socialLinks?: Array<{ platform: string; url: string }> | null;
};

/**
 * Default colors used in block examples that should be replaced.
 * These are the colors used in our pre-built templates that get
 * swapped with brand kit colors when applied.
 */
const DEFAULT_COLORS = {
  // Primary brand color (buttons, links, accents)
  primary: "#5046e5",
  // Secondary/lighter primary (icon backgrounds, highlights)
  primaryLight: "#e0e7ff",
  // Alternative primary colors (blue variant used in some icons)
  primaryAlt: "#3b82f6",
  primaryAltLight: "#dbeafe",
  // Secondary accent color
  secondary: "#6366f1",
  // Background colors
  background: "#ffffff",
  backgroundMuted: "#f9fafb",
  backgroundSubtle: "#f8fafc",
  // Text colors
  text: "#1f2937",
  textMuted: "#6b7280",
  textLight: "#9ca3af",
  // Border/divider colors
  border: "#e5e7eb",
};

/**
 * Recursively applies brand kit values to TipTap JSON content.
 * Replaces default colors with brand kit colors and substitutes
 * variables like {{logoUrl}} and {{companyName}} with actual values.
 */
export function applyBrandKitToContent(
  content: JSONContent,
  brandKit: BrandKitValues
): JSONContent {
  // Deep clone to avoid mutating original
  const result = JSON.parse(JSON.stringify(content)) as JSONContent;
  return transformNode(result, brandKit);
}

function transformNode(
  node: JSONContent,
  brandKit: BrandKitValues
): JSONContent {
  // Transform attributes
  if (node.attrs) {
    node.attrs = transformAttributes(node.attrs, brandKit, node.type);
  }

  // Transform marks (for text styling)
  if (node.marks) {
    node.marks = node.marks.map((mark) => transformMark(mark, brandKit));
  }

  // Transform text content (replace variables)
  if (node.type === "text" && typeof node.text === "string") {
    node.text = replaceVariables(node.text, brandKit);
  }

  // Recursively transform children
  if (node.content) {
    node.content = node.content.map((child) => transformNode(child, brandKit));
  }

  return node;
}

function transformAttributes(
  attrs: Record<string, unknown>,
  brandKit: BrandKitValues,
  nodeType?: string
): Record<string, unknown> {
  const result = { ...attrs };

  // Color attributes
  const colorAttrs = [
    "backgroundColor",
    "color",
    "textColor",
    "iconColor",
    "borderColor",
  ];

  for (const attr of colorAttrs) {
    if (typeof result[attr] === "string") {
      result[attr] = transformColor(result[attr] as string, brandKit);
    }
  }

  // Button-specific transformations
  if (nodeType === "emailButton") {
    // Apply button radius from brand kit
    if (brandKit.buttonRadius && !result.borderRadius) {
      result.borderRadius = brandKit.buttonRadius;
    } else if (
      brandKit.buttonStyle &&
      typeof result.borderRadius === "string"
    ) {
      // Apply button style (rounded, square, pill)
      const radiusMap: Record<string, string> = {
        square: "0px",
        rounded: brandKit.buttonRadius || "4px",
        pill: "9999px",
      };
      if (radiusMap[brandKit.buttonStyle]) {
        result.borderRadius = radiusMap[brandKit.buttonStyle];
      }
    }
  }

  // Replace variable placeholders in string attributes
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      result[key] = replaceVariables(value, brandKit);
    }
  }

  return result;
}

function transformMark(
  mark: { type: string; attrs?: Record<string, unknown> },
  brandKit: BrandKitValues
): { type: string; attrs?: Record<string, unknown> } {
  if (!mark.attrs) return mark;

  const result = { ...mark, attrs: { ...mark.attrs } };

  // Transform textStyle color
  if (mark.type === "textStyle" && typeof result.attrs.color === "string") {
    result.attrs.color = transformColor(result.attrs.color, brandKit);
  }

  return result;
}

/**
 * Lightens a hex color by mixing it with white
 * @param hex - Hex color string (e.g., "#5046e5")
 * @param amount - Amount to lighten (0-1, where 1 is white)
 */
function lightenColor(hex: string, amount: number): string {
  // Remove # if present
  const color = hex.replace("#", "");

  // Parse RGB values
  const r = Number.parseInt(color.substring(0, 2), 16);
  const g = Number.parseInt(color.substring(2, 4), 16);
  const b = Number.parseInt(color.substring(4, 6), 16);

  // Mix with white
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

function transformColor(color: string, brandKit: BrandKitValues): string {
  const colorLower = color.toLowerCase();

  // Primary color and its variants
  if (
    (colorLower === DEFAULT_COLORS.primary ||
      colorLower === DEFAULT_COLORS.primaryAlt) &&
    brandKit.primaryColor
  ) {
    return brandKit.primaryColor;
  }

  // Light/muted versions of primary (icon backgrounds, highlights)
  if (
    (colorLower === DEFAULT_COLORS.primaryLight ||
      colorLower === DEFAULT_COLORS.primaryAltLight) &&
    brandKit.primaryColor
  ) {
    // Generate a light version of the primary color (85% towards white)
    return lightenColor(brandKit.primaryColor, 0.85);
  }

  // Secondary color
  if (colorLower === DEFAULT_COLORS.secondary && brandKit.secondaryColor) {
    return brandKit.secondaryColor;
  }

  // Background colors
  if (colorLower === DEFAULT_COLORS.background && brandKit.backgroundColor) {
    return brandKit.backgroundColor;
  }

  // Text color
  if (colorLower === DEFAULT_COLORS.text && brandKit.textColor) {
    return brandKit.textColor;
  }

  // Muted text - keep as-is for now since it's usually gray regardless of brand
  // Could potentially derive from textColor in the future

  return color;
}

function replaceVariables(text: string, brandKit: BrandKitValues): string {
  let result = text;

  // Replace common variables with brand kit values (or placeholders)
  result = result.replace(
    /\{\{logoUrl\}\}/g,
    brandKit.logoUrl || PLACEHOLDER_IMAGES.logo
  );

  if (brandKit.companyName) {
    result = result.replace(/\{\{companyName\}\}/g, brandKit.companyName);
  } else {
    // Replace with generic company name placeholder
    result = result.replace(/\{\{companyName\}\}/g, "Your Company");
  }

  return result;
}

/**
 * Creates a brand kit values object from a database brand kit record
 */
export function brandKitToValues(
  brandKit: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
    backgroundColor?: string | null;
    textColor?: string | null;
    fontFamily?: string | null;
    headingFontFamily?: string | null;
    buttonStyle?: string | null;
    buttonRadius?: string | null;
    companyName?: string | null;
    logoUrl?: string | null;
    socialLinks?: Array<{ platform: string; url: string }> | null;
  } | null
): BrandKitValues | null {
  if (!brandKit) return null;
  return brandKit;
}
