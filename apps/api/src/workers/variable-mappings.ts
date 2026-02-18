export type VariableSource =
  | { type: "static"; value: string }
  | { type: "contact"; field: string };

export type VariableMapping = {
  variableName: string;
  source: VariableSource;
};

type ContactData = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
  jobTitle: string | null;
  properties: Record<string, unknown>;
};

const CONTACT_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "company",
  "jobTitle",
]);

export function applyVariableMappings(
  existingData: Record<string, string>,
  mappings: VariableMapping[] | undefined,
  contact: ContactData
): Record<string, string> {
  if (!mappings || mappings.length === 0) {
    return existingData;
  }

  const result = { ...existingData };

  for (const mapping of mappings) {
    if (mapping.source.type === "static") {
      result[mapping.variableName] = mapping.source.value;
    } else if (mapping.source.type === "contact") {
      const field = mapping.source.field;
      if (field.startsWith("properties.")) {
        const propKey = field.slice("properties.".length);
        const value = contact.properties[propKey];
        result[mapping.variableName] = value != null ? String(value) : "";
      } else if (CONTACT_FIELDS.has(field)) {
        const value = contact[field as keyof Omit<ContactData, "properties">];
        result[mapping.variableName] = typeof value === "string" ? value : "";
      }
    }
  }

  return result;
}
