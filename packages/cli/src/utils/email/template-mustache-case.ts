/**
 * Normalize Handlebars mustache tokens in plain-text output.
 *
 * `@react-email/render({ plainText: true })` uppercases `<Heading>` content
 * via html-to-text's default h1 behavior. When a template puts Handlebars
 * syntax inside a heading, the plain-text version contains tokens like
 * `{{#IF FIRSTNAME}}` instead of `{{#if firstName}}`. SES Handlebars is
 * case-sensitive — it will not recognize `#IF` as the `if` block helper
 * and reports the variable `IF` as missing from the rendering data.
 *
 * This function restores the original casing of known Handlebars keywords
 * (if/unless/each/with/else) and known template variable names so the
 * plain-text body parses identically to the HTML body at SES send time.
 *
 * Tokens whose names are not in either the keyword set or the canonical
 * variable set are left untouched — we only rewrite what we know.
 */

const HANDLEBARS_BLOCK_HELPERS = new Set(["if", "unless", "each", "with"]);

export function normalizePlainTextMustaches(
  text: string,
  canonicalVars: Set<string>
): string {
  // Build a lowercased lookup so we can match an uppercased plain-text token
  // back to its canonical camelCase variable name.
  const canonicalByLower = new Map<string, string>();
  for (const name of canonicalVars) {
    canonicalByLower.set(name.toLowerCase(), name);
  }

  function restoreIdentifier(name: string): string {
    const lower = name.toLowerCase();
    return canonicalByLower.get(lower) ?? name;
  }

  return text.replace(
    /\{\{([#/]?)([A-Z][A-Z0-9_]*)((?:\s+[A-Z0-9_.]+)*)\s*\}\}/g,
    (match, sigil: string, name: string, args: string) => {
      const lower = name.toLowerCase();
      const isHelper = lower === "else" || HANDLEBARS_BLOCK_HELPERS.has(lower);
      const restoredArgs = args
        .split(/\s+/)
        .filter(Boolean)
        .map(restoreIdentifier)
        .join(" ");
      if (isHelper) {
        const suffix = restoredArgs ? ` ${restoredArgs}` : "";
        return `{{${sigil}${lower}${suffix}}}`;
      }
      // Not a helper — check if the leading identifier is a known variable
      // and the block has no trailing args (variables don't take arguments).
      if (!args && canonicalByLower.has(lower)) {
        return `{{${sigil}${canonicalByLower.get(lower)}}}`;
      }
      return match;
    }
  );
}
