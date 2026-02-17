type FieldGroup = {
  label: string;
  fields: { value: string; label: string }[];
};

export const CONDITION_FIELD_GROUPS: FieldGroup[] = [
  {
    label: "Profile",
    fields: [
      { value: "email", label: "Email" },
      { value: "emailStatus", label: "Email Status" },
      { value: "firstName", label: "First Name" },
      { value: "lastName", label: "Last Name" },
      { value: "company", label: "Company" },
      { value: "jobTitle", label: "Job Title" },
      { value: "phone", label: "Phone" },
      { value: "smsStatus", label: "SMS Status" },
      { value: "preferredChannel", label: "Preferred Channel" },
    ],
  },
  {
    label: "Email Activity",
    fields: [
      { value: "emailsSent", label: "Emails Sent" },
      { value: "emailsOpened", label: "Emails Opened" },
      { value: "emailsClicked", label: "Emails Clicked" },
      { value: "lastEmailSentAt", label: "Last Email Sent At" },
      { value: "lastEmailOpenedAt", label: "Last Email Opened At" },
      { value: "lastEmailClickedAt", label: "Last Email Clicked At" },
    ],
  },
  {
    label: "SMS Activity",
    fields: [
      { value: "smsSent", label: "SMS Sent" },
      { value: "smsClicked", label: "SMS Clicked" },
      { value: "lastSmsSentAt", label: "Last SMS Sent At" },
      { value: "lastSmsClickedAt", label: "Last SMS Clicked At" },
    ],
  },
  {
    label: "General",
    fields: [
      { value: "lastActivityAt", label: "Last Activity At" },
      { value: "createdAt", label: "Created At" },
    ],
  },
];

const fieldLabelMap = new Map<string, string>();
for (const group of CONDITION_FIELD_GROUPS) {
  for (const field of group.fields) {
    fieldLabelMap.set(field.value, field.label);
  }
}

export function getFieldLabel(value: string): string {
  if (fieldLabelMap.has(value)) {
    return fieldLabelMap.get(value)!;
  }
  if (value.startsWith("properties.")) {
    return value.replace("properties.", "");
  }
  return value;
}
