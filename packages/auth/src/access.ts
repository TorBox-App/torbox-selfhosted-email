import { createAccessControl } from "better-auth/plugins/access";

export const ac = createAccessControl({
  contacts: ["read", "write", "delete", "import", "export"],
  templates: ["read", "write", "publish", "delete"],
  broadcasts: ["read", "write", "send", "delete"],
  events: ["read", "export"],
  workflows: ["read", "write", "delete"],
  segments: ["read", "write", "delete"],
  topics: ["read", "write", "delete"],
  apiKeys: ["read", "write", "delete"],
  awsAccounts: ["read", "write", "delete"],
  members: ["read", "invite", "remove", "changeRole"],
  sso: ["read", "write", "delete"],
  orgSettings: ["read", "write"],
  billing: ["read", "write"],
} as const);

export const ownerRole = ac.newRole({
  contacts: ["read", "write", "delete", "import", "export"],
  templates: ["read", "write", "publish", "delete"],
  broadcasts: ["read", "write", "send", "delete"],
  events: ["read", "export"],
  workflows: ["read", "write", "delete"],
  segments: ["read", "write", "delete"],
  topics: ["read", "write", "delete"],
  apiKeys: ["read", "write", "delete"],
  awsAccounts: ["read", "write", "delete"],
  members: ["read", "invite", "remove", "changeRole"],
  sso: ["read", "write", "delete"],
  orgSettings: ["read", "write"],
  billing: ["read", "write"],
});

export const adminRole = ac.newRole({
  contacts: ["read", "write", "delete", "import", "export"],
  templates: ["read", "write", "publish", "delete"],
  broadcasts: ["read", "write", "send", "delete"],
  events: ["read", "export"],
  workflows: ["read", "write", "delete"],
  segments: ["read", "write", "delete"],
  topics: ["read", "write", "delete"],
  apiKeys: ["read", "write", "delete"],
  awsAccounts: ["read", "write", "delete"],
  members: ["read", "invite", "remove", "changeRole"],
  sso: ["read", "write", "delete"],
  orgSettings: ["read", "write"],
  billing: ["read", "write"],
});

// member: full content + workflow access, no admin-level operations
export const memberRole = ac.newRole({
  contacts: ["read", "write", "delete", "import", "export"],
  templates: ["read", "write", "publish", "delete"],
  broadcasts: ["read", "write", "send", "delete"],
  events: ["read", "export"],
  workflows: ["read", "write", "delete"],
  segments: ["read", "write", "delete"],
  topics: ["read", "write", "delete"],
  apiKeys: ["read"],
  awsAccounts: ["read"],
  members: ["read"],
});

// marketing: full content write, read-only workflows/segments/topics, no admin ops
export const marketingRole = ac.newRole({
  contacts: ["read", "write", "delete", "import", "export"],
  templates: ["read", "write", "publish", "delete"],
  broadcasts: ["read", "write", "send", "delete"],
  events: ["read", "export"],
  workflows: ["read"],
  segments: ["read"],
  topics: ["read"],
  apiKeys: ["read"],
  awsAccounts: ["read"],
  members: ["read"],
});

// read-only: read/export on all content, no writes
export const readOnlyRole = ac.newRole({
  contacts: ["read", "export"],
  templates: ["read"],
  broadcasts: ["read"],
  events: ["read"],
  workflows: ["read"],
  segments: ["read"],
  topics: ["read"],
  apiKeys: ["read"],
  awsAccounts: ["read"],
  members: ["read"],
});

// billing: billing write + read-only access to all content + org context
export const billingRole = ac.newRole({
  contacts: ["read"],
  templates: ["read"],
  broadcasts: ["read"],
  events: ["read"],
  workflows: ["read"],
  segments: ["read"],
  topics: ["read"],
  apiKeys: ["read"],
  awsAccounts: ["read"],
  members: ["read"],
  orgSettings: ["read"],
  billing: ["read", "write"],
});

export const roles = {
  owner: ownerRole,
  admin: adminRole,
  member: memberRole,
  marketing: marketingRole,
  "read-only": readOnlyRole,
  billing: billingRole,
} as const;

export type RoleName = keyof typeof roles;
export type ResourceName = keyof typeof ac.statements;
