# Wraps Template Render (packages/template-render)

Canonical Handlebars template rendering for Wraps. One place for substitution logic so the dashboard preview, test-email endpoint, workflow worker, and subscription confirmation all render the same way.

## Critical Rules

### 1. Preview Paths Use `renderTemplate`, Send Paths Must Use `renderTemplateStrict`

- `renderTemplate(html, data)` — swallows compile and runtime errors, returns raw template on failure. Safe for preview panes where a broken template must not crash the UI.
- `renderTemplateStrict(html, data)` — errors propagate. **Required for all send paths.** A silently-failing render would deliver raw `{{#if}}` blocks to real inboxes.

### 2. Nothing Is Ever HTML-Escaped — SES Is the Reference

Renderers here never entity-encode variable values, and there is no flag to turn escaping on. SES renders template-backed sends server-side and substitutes `TemplateData` verbatim (verified against the live `ses test-render-template` API). Any renderer that escaped would make the dashboard preview, the test send, and the raw-HTML send path disagree with the SES-rendered broadcast for the same template and contact.

Two consequences:
- Markup in a variable value renders as markup. That is how a broadcast author gets a real line break from `<br>` in a `{{content}}` value.
- This layer sanitizes nothing. Anything rendering into a **browser** DOM rather than an email must isolate the output in a sandboxed iframe — never `dangerouslySetInnerHTML`.

### 3. Use `nestKeys()` for Dot-Notation Variables

Handlebars treats `{{contact.firstName}}` as a path lookup, not a flat-key lookup. Callers that build flat dicts with dotted keys (most do) must call `nestKeys(data)` before rendering, or Handlebars returns empty strings for all dotted variables.

### 4. Handlebars Is the Only Allowed Renderer

This package was extracted to eliminate ad-hoc `{{var}}` regex substituters scattered across the codebase. Do not add a second rendering engine here. If a new template format is needed, propose a new package and update this one.

## Consumers

- `apps/api` — workflow step rendering, subscription confirmation
- `apps/web` — dashboard preview carousel, test-send endpoint

## Commands

```bash
pnpm --filter @wraps/template-render build     # Build with tsdown
pnpm --filter @wraps/template-render test      # Run vitest
pnpm --filter @wraps/template-render gate:ses  # Smoke-test render against all SES templates
```
