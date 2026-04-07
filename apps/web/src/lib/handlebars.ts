/**
 * Shared Handlebars helpers used by template compilation, the broadcast
 * variable mapper action, and any preview iframe that needs to substitute
 * variables and evaluate {{#if}}/{{else}}/{{/if}} blocks.
 *
 * Kept in its own module so server actions and client components can import
 * just these helpers without pulling in compile-template.ts's heavy
 * sucrase / @react-email/render dependencies.
 */

import {
  type CompiledTemplate,
  nestKeys as canonicalNestKeys,
  compileTemplate,
} from "@wraps/template-render";

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
 * Re-export the canonical `nestKeys` from `@wraps/template-render`. This
 * file used to ship its own copy; the canonical version is now the single
 * source of truth and the dashboard preview, the broadcast variable mapper,
 * the subscription mailer, and any future consumer all share it.
 */
export const nestKeys = canonicalNestKeys;

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
// Bounded cache of compiled templates keyed by html string. The carousel
// re-renders 5 times per recipient swap and the editor re-renders on every
// keystroke; without memoization we'd recompile the same template
// repeatedly. 32 entries is enough for any realistic preview session — when
// full we drop everything and start over (a proper LRU isn't worth the
// complexity at this scale).
//
// The compile + render itself lives in @wraps/template-render so the
// dashboard preview, the test-send endpoint, the workflow worker, and the
// subscription mailer all use the same code path. This module just adds
// the per-html memoization layer that's specific to the browser-side
// preview hot path.
const COMPILE_CACHE_MAX = 32;
const compileCache = new Map<string, CompiledTemplate>();

function getCompiledTemplate(html: string): CompiledTemplate {
  const cached = compileCache.get(html);
  if (cached) {
    return cached;
  }
  const tmpl = compileTemplate(html);
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
  return getCompiledTemplate(html)(data);
}
