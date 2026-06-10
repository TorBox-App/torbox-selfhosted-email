/**
 * Canonical template rendering for Wraps.
 *
 * Every layer that needs to turn a Handlebars-flavored string + a data dict
 * into a final string goes through this module: the dashboard preview, the
 * test-email endpoint, the workflow worker's raw-HTML fallback, and the
 * subscription confirmation mailer. Centralizing here means callers can't
 * accidentally re-implement a regex `{{var}}` substituter and ship raw
 * `{{#if}}` blocks to inboxes — which is exactly the bug that motivated
 * extracting this package.
 *
 * `compileTemplate(html)` returns a reusable function that renders the
 * template against any data shape. Memoizing callers (like the broadcast
 * preview carousel) hold the returned function in a per-html cache.
 *
 * `renderTemplate(html, data)` is one-shot sugar for callers that don't
 * need to retain the compiled function (test-send, workflow fallback,
 * subscription confirmation).
 *
 * Both swallow compile and runtime errors and return the raw template
 * string instead — a malformed template should not crash a preview pane
 * or a send endpoint.
 */

import Handlebars from "handlebars";

export type CompiledTemplate = (data: Record<string, unknown>) => string;

export function compileTemplate(html: string): CompiledTemplate {
  let compiled: HandlebarsTemplateDelegate;
  try {
    compiled = Handlebars.compile(html, { noEscape: false });
  } catch {
    return () => html;
  }
  return (data: Record<string, unknown>) => {
    try {
      return compiled(data);
    } catch {
      return html;
    }
  };
}

export function renderTemplate(
  html: string,
  data: Record<string, unknown>
): string {
  return compileTemplate(html)(data);
}

/**
 * Like `renderTemplate`, but compile and runtime errors propagate instead
 * of falling back to the raw template string. Send paths must use this
 * variant: a renderer that silently returns the input would deliver raw
 * `{{#if}}` blocks to a real inbox. Preview panes keep using the
 * swallowing variants above.
 *
 * `noEscape: true` disables Handlebars HTML-entity escaping of variable
 * values. Use it for any output that is NOT HTML — email subjects, SMS
 * bodies, plain-text parts — where `O'Brien` must stay `O'Brien`, not
 * become `O&#x27;Brien`. HTML bodies must keep the default escaping.
 */
export function renderTemplateStrict(
  html: string,
  data: Record<string, unknown>,
  options: { noEscape?: boolean } = {}
): string {
  return Handlebars.compile(html, { noEscape: options.noEscape ?? false })(
    data
  );
}

/**
 * Convert a flat dict whose keys may use dot notation into a Handlebars-
 * friendly nested object that supports both forms.
 *
 * Handlebars treats `{{contact.firstName}}` as a path lookup
 * (`data.contact.firstName`), not a flat-key lookup
 * (`data["contact.firstName"]`). Many callers (the dashboard preview, the
 * subscription confirmation mailer, etc.) build flat dicts with dotted
 * strings, so without this helper Handlebars can't resolve nested
 * variables and the rendered output is empty.
 *
 * The output preserves the original flat keys too, so templates that use
 * the short alias (`{{firstName}}`) continue to work alongside templates
 * that use the dotted form (`{{contact.firstName}}`).
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
    if (segments.length === 0) {
      continue;
    }
    let cursor: Record<string, unknown> = out;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (seg === undefined) {
        continue;
      }
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
    const lastSegment = segments.at(-1);
    if (lastSegment !== undefined) {
      cursor[lastSegment] = value;
    }
  }

  return out;
}
