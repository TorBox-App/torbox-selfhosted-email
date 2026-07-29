import type { PreferenceCenterTheme } from "@wraps/db";
import { THEME_TOKEN_SET } from "./tokens";
import { isValidColorValue, isValidRadiusValue } from "./validate";

const SCOPE_SELECTOR_PATTERN = /^[A-Za-z0-9.\-[\]="'_ :]+$/;

/**
 * Defense-in-depth: re-validate every value against the same grammar used on
 * ingest. Even a hand-tampered DB row cannot emit anything but
 * `--<allowlisted-name>: <grammar-valid-value>;` — this function is the last
 * line of defense before the string is written into a <style> tag.
 */
function buildDeclarations(mode: Record<string, string>): string {
  const declarations: string[] = [];
  for (const [name, value] of Object.entries(mode)) {
    if (!THEME_TOKEN_SET.has(name)) {
      continue;
    }
    const isRadius = name === "radius";
    const isValid = isRadius
      ? isValidRadiusValue(value)
      : isValidColorValue(value);
    if (!isValid) {
      continue;
    }
    declarations.push(`--${name}: ${value};`);
  }
  return declarations.join(" ");
}

/**
 * Serialize a validated theme into scoped CSS custom properties. `scopeId`
 * is developer-supplied (never user input), so a bad selector throws instead
 * of being silently dropped.
 */
export function themeToScopedCss(
  theme: PreferenceCenterTheme,
  scopeSelector: string
): string {
  if (!SCOPE_SELECTOR_PATTERN.test(scopeSelector)) {
    throw new Error(`Invalid scope selector: ${scopeSelector}`);
  }

  const lightDeclarations = buildDeclarations(theme.light);
  const darkDeclarations = buildDeclarations(theme.dark);

  const blocks: string[] = [];

  if (theme.colorScheme === "dark") {
    // Dark tokens are emitted under the base selector so they apply
    // regardless of the visitor's OS setting.
    if (darkDeclarations) {
      blocks.push(`${scopeSelector} { ${darkDeclarations} }`);
    }
  } else if (theme.colorScheme === "light") {
    if (lightDeclarations) {
      blocks.push(`${scopeSelector} { ${lightDeclarations} }`);
    }
  } else {
    // "system": light tokens on the base selector, dark tokens under
    // `.dark <scope>`. Specificity is (0,2,0) vs (0,1,0), so `.dark <scope>`
    // correctly wins when <html> carries `.dark`.
    if (lightDeclarations) {
      blocks.push(`${scopeSelector} { ${lightDeclarations} }`);
    }
    if (darkDeclarations) {
      blocks.push(`.dark ${scopeSelector} { ${darkDeclarations} }`);
    }
  }

  return blocks.join(" ");
}
