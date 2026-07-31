/**
 * Escape a value for interpolation into an HTML email body.
 *
 * Every email builder in this package assembles `html` with template literals,
 * and several interpolate values that an end user controls — a broadcast name,
 * an organization name, a topic name, an AWS account nickname. Without escaping,
 * a user can plant working markup (most usefully an `<a href>`) into a message
 * that is delivered from a Wraps-verified sender, which lends our reputation to
 * whatever they wrote. Some of those messages go to *external* recipients
 * (invitees, topic subscribers), so the blast radius is not limited to the org.
 *
 * Apply to every interpolated value in an `html` string. Do NOT apply to the
 * `text` variant (escaping there would surface literal `&amp;` to the reader),
 * nor to `subject` — SES sends subjects as a header, not markup.
 *
 * URLs we construct ourselves (resolveAppUrl + an id) are safe by construction
 * but are escaped anyway: it costs nothing and removes the need for a reader to
 * re-derive which interpolations are trusted.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
