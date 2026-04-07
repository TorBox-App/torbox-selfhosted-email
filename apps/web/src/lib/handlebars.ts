/**
 * Shared Handlebars helpers used by template compilation, the broadcast
 * variable mapper action, and any preview iframe that needs to substitute
 * variables and evaluate {{#if}}/{{else}}/{{/if}} blocks.
 *
 * Kept in its own module so server actions and client components can import
 * just these helpers without pulling in compile-template.ts's heavy
 * sucrase / @react-email/render dependencies.
 */

import Handlebars from "handlebars";

/**
 * Bare-word Handlebars tokens that the variable extractor regex matches
 * but should NOT be surfaced as user variables.
 *
 * The regex `/\{\{([a-zA-Z0-9_.]+)(?:\|([^}]*))?\}\}/g` already skips the
 * common block helper forms `{{#if}}`, `{{/if}}`, `{{#each}}`, `{{/each}}`
 * (because of `#` and `/`). Only two bare words actually slip through:
 *
 *   - `{{else}}` — the alternate branch of an `{{#if}}` or `{{#unless}}`
 *   - `{{this}}` — the current Handlebars context reference
 *
 * Keep this set tight. Adding `if` / `unless` / `each` / `with` here
 * would be misleading because those forms can never appear bare in the
 * regex output, and an over-broad set risks filtering future user vars.
 */
export const HANDLEBARS_KEYWORDS = new Set(["else", "this"]);

/**
 * Convert a flat dict whose keys may use dot notation into a Handlebars-
 * friendly object that supports both forms.
 *
 * Handlebars treats `{{contact.firstName}}` as a path lookup
 * (`data.contact.firstName`), not a flat-key lookup
 * (`data["contact.firstName"]`). Our preview callers build flat dicts with
 * dotted strings, so without this helper Handlebars can't resolve nested
 * variables and the preview shows blanks.
 *
 * The output preserves the original flat keys too, so templates that
 * use the short alias (`{{firstName}}`) continue to work alongside
 * templates that use the dotted form (`{{contact.firstName}}`).
 */
export function nestKeys(
  flat: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...flat };

  for (const [key, value] of Object.entries(flat)) {
    if (!key.includes(".")) {
      continue;
    }
    const segments = key.split(".");
    let cursor: Record<string, unknown> = out;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const existing = cursor[seg];
      if (
        typeof existing !== "object" ||
        existing === null ||
        Array.isArray(existing)
      ) {
        // Replace primitives or missing values with a fresh object so we
        // can keep nesting under it.
        cursor[seg] = {};
      }
      cursor = cursor[seg] as Record<string, unknown>;
    }
    cursor[segments.at(-1) as string] = value;
  }

  return out;
}

/**
 * Render compiled template HTML through Handlebars with substitution data
 * so a preview iframe shows what the email will actually look like —
 * including `{{#if}}/{{else}}/{{/if}}` block evaluation and `{{var}}`
 * substitution.
 *
 * The compiled HTML stored in the database keeps its raw `{{var}}`
 * placeholders (so SES and the workflow runtime can substitute per-recipient
 * at send time). This helper is for *display only* in the dashboard.
 *
 * Falls back to the raw HTML if Handlebars compilation fails so a malformed
 * template doesn't blank out the preview pane.
 */
// Bounded cache of compiled Handlebars templates keyed by html string.
// The carousel re-renders 5 times per recipient swap and the editor
// re-renders on every keystroke; without memoization we'd recompile the
// same template repeatedly. 32 entries is enough for any realistic
// preview session — when full we drop everything and start over (a
// proper LRU isn't worth the complexity at this scale).
const COMPILE_CACHE_MAX = 32;
const compileCache = new Map<string, HandlebarsTemplateDelegate>();

function getCompiledTemplate(html: string): HandlebarsTemplateDelegate {
  const cached = compileCache.get(html);
  if (cached) {
    return cached;
  }
  const tmpl = Handlebars.compile(html, { noEscape: false });
  if (compileCache.size >= COMPILE_CACHE_MAX) {
    compileCache.clear();
  }
  compileCache.set(html, tmpl);
  return tmpl;
}

export function renderForPreview(
  html: string,
  data: Record<string, unknown>
): string {
  if (!html) {
    return html;
  }
  try {
    const tmpl = getCompiledTemplate(html);
    return tmpl(data);
  } catch (err) {
    console.warn("renderForPreview: Handlebars compile failed", err);
    return html;
  }
}
