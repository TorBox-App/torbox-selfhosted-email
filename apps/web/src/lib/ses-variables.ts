/**
 * SES Variable Transformation Utilities
 *
 * SES Handlebars requires flat variable names (no dot notation).
 * These utilities transform our variable format to SES-compatible format.
 */

/**
 * Convert our variable name (dot notation) to SES-compatible format (camelCase)
 * Examples:
 *   - "contact.email" → "contactEmail"
 *   - "contact.firstName" → "contactFirstName"
 *   - "organization.name" → "organizationName"
 *   - "unsubscribeUrl" → "unsubscribeUrl" (no change)
 */
export function toSesVariableName(name: string): string {
  if (!name.includes(".")) {
    return name;
  }

  const parts = name.split(".");
  return parts
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
}

/**
 * Transform HTML content to use SES-compatible variable names
 * Handles both simple and fallback formats:
 *   - {{contact.email}} → {{contactEmail}}
 *   - {{firstName|there}} → {{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}
 *
 * SES uses Handlebars syntax for conditionals.
 */
export function transformVariablesForSes(html: string): string {
  // Match {{variableName}} or {{variableName|fallback}} patterns, including with whitespace
  // The fallback part [^}]* uses * instead of + to allow empty fallback values
  return html.replace(
    /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*([^}]*))?\s*\}\}/g,
    (_match, varName, fallback) => {
      const sesName = toSesVariableName(varName);

      // If there's a fallback value (including empty string after |), use Handlebars conditional
      if (fallback !== undefined) {
        const trimmedFallback = fallback.trim();
        return `{{#if ${sesName}}}{{${sesName}}}{{else}}${trimmedFallback}{{/if}}`;
      }

      return `{{${sesName}}}`;
    }
  );
}

/**
 * Build SES template data object with flattened variable names
 * Input: { contact: { email: "foo@bar.com", firstName: "John" }, unsubscribeUrl: "..." }
 * Output: { contactEmail: "foo@bar.com", contactFirstName: "John", unsubscribeUrl: "..." }
 */
export function flattenVariablesForSes(
  data: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};

  function flatten(obj: Record<string, unknown>, prefix = "") {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix
        ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`
        : key;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, newKey);
      } else {
        // SES requires string values
        result[newKey] = value != null ? String(value) : "";
      }
    }
  }

  flatten(data);
  return result;
}
