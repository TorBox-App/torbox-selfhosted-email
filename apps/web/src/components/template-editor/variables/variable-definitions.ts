import type { VariableContext } from "../core/editor-context";

/**
 * Variable definition for email templates
 */
export type VariableDefinition = {
  /** Variable name used in templates (e.g., "contact.firstName") */
  name: string;
  /** Human-readable label */
  label: string;
  /** Variable type for validation/display */
  type: "text" | "number" | "boolean" | "date" | "url" | "email";
  /** Optional description */
  description?: string;
  /** Whether this variable is required (e.g., confirmationUrl for confirmation emails) */
  required?: boolean;
  /** Category for grouping in UI */
  category?: "contact" | "system" | "topic" | "trigger" | "organization";
};

// =============================================================================
// BROADCAST VARIABLES
// Variables available when sending broadcast emails to contacts
// =============================================================================

const contactVariables: VariableDefinition[] = [
  {
    name: "contact.email",
    label: "Email Address",
    type: "email",
    description: "Contact's email address",
    category: "contact",
  },
  {
    name: "contact.firstName",
    label: "First Name",
    type: "text",
    description: "Contact's first name",
    category: "contact",
  },
  {
    name: "contact.lastName",
    label: "Last Name",
    type: "text",
    description: "Contact's last name",
    category: "contact",
  },
  {
    name: "contact.company",
    label: "Company",
    type: "text",
    description: "Contact's company name",
    category: "contact",
  },
  {
    name: "contact.jobTitle",
    label: "Job Title",
    type: "text",
    description: "Contact's job title",
    category: "contact",
  },
];

const systemVariables: VariableDefinition[] = [
  {
    name: "unsubscribeUrl",
    label: "Unsubscribe URL",
    type: "url",
    description: "Link to unsubscribe from emails",
    category: "system",
  },
  {
    name: "preferencesUrl",
    label: "Preferences URL",
    type: "url",
    description: "Link to email preferences center",
    category: "system",
  },
  {
    name: "organization.name",
    label: "Organization Name",
    type: "text",
    description: "Your organization's name",
    category: "organization",
  },
];

const broadcastVariables: VariableDefinition[] = [
  ...contactVariables,
  ...systemVariables,
];

// =============================================================================
// CONFIRMATION VARIABLES
// Variables available for double opt-in confirmation emails
// =============================================================================

const confirmationVariables: VariableDefinition[] = [
  // Required - the confirmation link
  {
    name: "confirmationUrl",
    label: "Confirmation URL",
    type: "url",
    description: "Link to confirm subscription (REQUIRED)",
    required: true,
    category: "system",
  },
  // Topic info
  {
    name: "topic.name",
    label: "Topic Name",
    type: "text",
    description: "Name of the topic being subscribed to",
    category: "topic",
  },
  {
    name: "topic.description",
    label: "Topic Description",
    type: "text",
    description: "Description of the topic",
    category: "topic",
  },
  // Contact info (limited - may not have full profile yet)
  {
    name: "contact.email",
    label: "Email Address",
    type: "email",
    description: "Contact's email address",
    category: "contact",
  },
  {
    name: "contact.firstName",
    label: "First Name",
    type: "text",
    description: "Contact's first name (if provided)",
    category: "contact",
  },
  // Organization
  {
    name: "organization.name",
    label: "Organization Name",
    type: "text",
    description: "Your organization's name",
    category: "organization",
  },
];

// =============================================================================
// AUTOMATION VARIABLES
// Variables available for automated email sequences (future)
// =============================================================================

const automationVariables: VariableDefinition[] = [
  ...contactVariables,
  ...systemVariables,
  // Trigger-specific variables
  {
    name: "trigger.eventType",
    label: "Trigger Event",
    type: "text",
    description: "The event that triggered this automation",
    category: "trigger",
  },
  {
    name: "trigger.timestamp",
    label: "Trigger Time",
    type: "date",
    description: "When the trigger event occurred",
    category: "trigger",
  },
];

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get variables available for a specific context
 */
export function getVariablesForContext(
  context: VariableContext
): VariableDefinition[] {
  switch (context) {
    case "broadcast":
      return broadcastVariables;
    case "confirmation":
      return confirmationVariables;
    case "automation":
      return automationVariables;
    default:
      return broadcastVariables;
  }
}

/**
 * Get required variables for a context
 */
export function getRequiredVariables(
  context: VariableContext
): VariableDefinition[] {
  return getVariablesForContext(context).filter((v) => v.required);
}

/**
 * Check if a template content contains all required variables
 */
export function validateRequiredVariables(
  content: string,
  context: VariableContext
): { valid: boolean; missing: string[] } {
  const required = getRequiredVariables(context);
  const missing: string[] = [];

  for (const variable of required) {
    // Check for {{variableName}} pattern
    const pattern = new RegExp(`\\{\\{\\s*${variable.name}\\s*\\}\\}`, "i");
    if (!pattern.test(content)) {
      missing.push(variable.name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Variables organized by context for export
 */
export const variablesByContext: Record<VariableContext, VariableDefinition[]> =
  {
    broadcast: broadcastVariables,
    confirmation: confirmationVariables,
    automation: automationVariables,
  };

/**
 * Convert VariableDefinition to the format expected by VariableSuggestion extension
 */
export function toSuggestionFormat(variables: VariableDefinition[]): Array<{
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "date" | "url" | "email";
  description?: string;
}> {
  return variables.map((v) => ({
    name: v.name,
    label: v.required ? `${v.label} *` : v.label,
    type: v.type,
    description: v.description,
  }));
}

// =============================================================================
// SES VARIABLE TRANSFORMATION
// SES Handlebars requires flat variable names (no dot notation)
// =============================================================================

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
 * Converts {{contact.email}} to {{contactEmail}}
 */
export function transformVariablesForSes(html: string): string {
  // Match {{variableName}} patterns, including with whitespace
  return html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, varName) => {
    const sesName = toSesVariableName(varName);
    return `{{${sesName}}}`;
  });
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
