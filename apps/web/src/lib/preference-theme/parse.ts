import { THEME_TOKEN_SET, THEME_TOKENS } from "./tokens";
import {
  isValidColorValue,
  isValidRadiusValue,
  normalizeLegacyHsl,
} from "./validate";

const MAX_INPUT_BYTES = 100 * 1024;
const MAX_DECLARATIONS_PER_MODE = THEME_TOKENS.length;

const BLOCK_PATTERN = /([^{}]+)\{([^{}]*)\}/g;
const DECLARATION_PATTERN = /--([a-z0-9-]+)\s*:\s*([^;]+)/g;
const COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;

export type ParseResult = {
  theme: { light: Record<string, string>; dark: Record<string, string> };
  warnings: string[];
};

type BlockKind = "light" | "dark" | null;

function classifySelector(rawSelector: string): BlockKind {
  const selector = rawSelector.trim();
  if (
    selector.includes(".dark") ||
    selector.includes('[data-theme="dark"]') ||
    selector.includes("prefers-color-scheme: dark")
  ) {
    return "dark";
  }
  if (
    (selector.includes(":root") ||
      /(^|[\s,])html([\s,.:{]|$)/.test(selector)) &&
    !selector.includes(".dark")
  ) {
    return "light";
  }
  return null;
}

/**
 * Parse a customer-pasted CSS stylesheet into an allow-listed token map.
 * Never throws — garbage input returns empty maps plus warnings. Raw CSS
 * itself is never retained; only validated token name -> value pairs survive.
 */
export function parseThemeCss(css: string): ParseResult {
  const warnings: string[] = [];
  const theme = {
    light: {} as Record<string, string>,
    dark: {} as Record<string, string>,
  };

  if (!css) {
    return { theme, warnings };
  }

  if (new TextEncoder().encode(css).length > MAX_INPUT_BYTES) {
    warnings.push("Ignored input — stylesheet is too large (over 100 KB).");
    return { theme, warnings };
  }

  const withoutComments = css.replace(COMMENT_PATTERN, "");

  let blockMatch: RegExpExecArray | null;
  BLOCK_PATTERN.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
  while ((blockMatch = BLOCK_PATTERN.exec(withoutComments)) !== null) {
    const [, rawSelector, body] = blockMatch;
    const kind = classifySelector(rawSelector);
    if (!kind) {
      const trimmedSelector = rawSelector.trim();
      if (trimmedSelector) {
        warnings.push(`Ignored block for selector "${trimmedSelector}".`);
      }
      continue;
    }

    let declMatch: RegExpExecArray | null;
    DECLARATION_PATTERN.lastIndex = 0;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
    while ((declMatch = DECLARATION_PATTERN.exec(body)) !== null) {
      const [, name, rawValue] = declMatch;
      const value = rawValue.trim();

      if (!THEME_TOKEN_SET.has(name)) {
        warnings.push(
          `Ignored --${name} in ${rawSelector.trim()} — the preference center doesn't use that token.`
        );
        continue;
      }

      if (
        !(name in theme[kind]) &&
        Object.keys(theme[kind]).length >= MAX_DECLARATIONS_PER_MODE
      ) {
        warnings.push(
          `Ignored --${name} in ${rawSelector.trim()} — too many declarations for this mode.`
        );
        continue;
      }

      const isRadius = name === "radius";
      const normalizedValue = isRadius ? value : normalizeLegacyHsl(value);
      const isValid = isRadius
        ? isValidRadiusValue(normalizedValue)
        : isValidColorValue(normalizedValue);

      if (!isValid) {
        warnings.push(
          `Ignored --${name} in ${rawSelector.trim()} — "${value}" isn't a supported value.`
        );
        continue;
      }

      theme[kind][name] = normalizedValue;
    }
  }

  return { theme, warnings };
}
