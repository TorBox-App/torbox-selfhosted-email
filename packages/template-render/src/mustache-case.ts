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

/**
 * Scan compiled HTML for every Handlebars identifier it references —
 * bare variables (`{{firstName}}`), fallback syntax (`{{firstName|there}}`),
 * and block-helper arguments (`{{#if firstName}}`). The HTML render
 * preserves authoring case, so this set is the source of truth for
 * restoring identifiers that html-to-text uppercased in the plain-text
 * render.
 */
export function extractCanonicalVars(html: string): Set<string> {
  const vars = new Set<string>();
  for (const m of html.matchAll(/\{\{([a-zA-Z0-9_.]+)(?:\|[^}]*)?\}\}/g)) {
    if (m[1]) {
      vars.add(m[1]);
    }
  }
  for (const m of html.matchAll(
    /\{\{[#/][a-zA-Z]+\s+([a-zA-Z0-9_.\s]+?)\s*\}\}/g
  )) {
    for (const arg of (m[1] ?? "").split(/\s+/)) {
      if (arg) {
        vars.add(arg);
      }
    }
  }
  return vars;
}

/**
 * Normalize a plain-text email body for SES, restoring Handlebars keyword
 * and identifier casing that the HTML→text conversion destroyed (h1/Heading
 * content gets uppercased, so `{{#if firstName}}` becomes `{{#IF FIRSTNAME}}`
 * — which SES rejects as a missing `IF` attribute at send time). Pass the
 * compiled HTML the text was derived from; it supplies the canonical casing.
 */
export function normalizePlainTextForSes(text: string, html: string): string {
  return normalizePlainTextMustaches(text, extractCanonicalVars(html));
}
