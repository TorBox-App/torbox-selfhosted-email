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
  // Lowercased lookup for the full identifier — handles both bare names
  // (`firstName`) and dotted paths (`contact.firstName`). The production
  // canonical set is built by scanning the original HTML output, which
  // preserves case, so full paths are always present when they should be.
  const canonicalByLower = new Map<string, string>();
  for (const name of canonicalVars) {
    canonicalByLower.set(name.toLowerCase(), name);
  }

  // Restore an identifier that may contain dots (e.g. CONTACT.FIRSTNAME).
  // Returns the original input unchanged when the lowercased form isn't
  // in the canonical set — being conservative is safer than guessing,
  // since a wrong guess just produces a different SES rejection error
  // while leaving the author with no obvious fix.
  function restoreIdentifier(name: string): string {
    return canonicalByLower.get(name.toLowerCase()) ?? name;
  }

  // Token regex: optional sigil, dotted name, optional space-separated args.
  // The name group now allows dots so {{CONTACT.FIRSTNAME}} matches as a
  // single token instead of leaving the trailing `.FIRSTNAME` unmatched.
  return text.replace(
    /\{\{([#/]?)([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*)((?:\s+[A-Z0-9_.]+)*)\s*\}\}/g,
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
      // Not a helper — restore the dotted identifier if its full form
      // is in the canonical set. Variables don't take trailing arguments,
      // so leave any template that has both a non-helper name AND args
      // alone.
      if (!args && canonicalByLower.has(lower)) {
        return `{{${sigil}${canonicalByLower.get(lower)}}}`;
      }
      return match;
    }
  );
}
