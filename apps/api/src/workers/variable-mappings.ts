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

function resolveContactField(
  contact: ContactData,
  field: string
): string | undefined {
  if (field.startsWith("properties.")) {
    const propKey = field.slice("properties.".length);
    const value = contact.properties[propKey];
    return value != null ? String(value) : "";
  }
  if (CONTACT_FIELDS.has(field)) {
    const value = contact[field as keyof Omit<ContactData, "properties">];
    return typeof value === "string" ? value : "";
  }
  return;
}

function resolveSource(
  source: VariableSource,
  contact: ContactData
): string | undefined {
  if (source.type === "static") {
    return source.value;
  }
  if (source.type === "contact") {
    return resolveContactField(contact, source.field);
  }
  return;
}

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
    const value = resolveSource(mapping.source, contact);
    if (value !== undefined) {
      result[mapping.variableName] = value;
    }
  }

  return result;
}
