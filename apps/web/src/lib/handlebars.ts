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
 * Handlebars block helpers and built-ins — not user template variables.
 *
 * The variable extractor regex `/\{\{([a-zA-Z0-9_.]+)(?:\|([^}]*))?\}\}/g`
 * correctly skips `{{#if}}` and `{{/if}}` (because of `#` and `/`), but
 * `{{else}}` matches as a bare word, so we filter it explicitly here.
 *
 * This set is also used as a defensive filter at read time so stale
 * `template.variables` jsonb rows from before the extractor was fixed
 * still produce a clean variable list in the dashboard UI.
 */
export const HANDLEBARS_KEYWORDS = new Set([
  "else",
  "this",
  "if",
  "unless",
  "each",
  "with",
  "lookup",
  "log",
]);

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
export function renderForPreview(
  html: string,
  data: Record<string, unknown>
): string {
  if (!html) {
    return html;
  }
  try {
    const tmpl = Handlebars.compile(html, { noEscape: false });
    return tmpl(data);
  } catch {
    return html;
  }
}
