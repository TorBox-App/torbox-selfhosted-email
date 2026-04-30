import { roles } from "@wraps/auth/access";

export const PRESET_ROLES = [
  {
    name: "marketing",
    label: "Marketing",
    description:
      "Can create and send broadcasts, edit templates, manage contacts",
  },
  {
    name: "read-only",
    label: "Read Only",
    description:
      "Can view broadcasts, templates, contacts, and settings — no writes",
  },
  {
    name: "billing",
    label: "Billing",
    description: "Can view and manage billing settings only",
  },
] as const;

export type PresetRoleName = (typeof PRESET_ROLES)[number]["name"];

export const VALID_ROLES = new Set<string>(Object.keys(roles));
