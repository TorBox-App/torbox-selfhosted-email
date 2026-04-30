import { describe, expect, it } from "vitest";
import { checkPermission } from "../shared/permissions";

// Exhaustive permission matrix for all 6 roles.
// If a role's permissions change in packages/auth/src/access.ts, a test here will catch it.
// Format: checkPermission(role, resource, [action]) — null means allowed, non-null means denied.

const allowed = (role: string, resource: string, actions: string[]) => {
  const result = checkPermission(role, resource as never, actions);
  expect(
    result,
    `${role} should be ALLOWED ${actions.join("+")} on ${resource}`
  ).toBeNull();
};

const denied = (role: string, resource: string, actions: string[]) => {
  const result = checkPermission(role, resource as never, actions);
  expect(
    result,
    `${role} should be DENIED ${actions.join("+")} on ${resource}`
  ).not.toBeNull();
  expect(result?.success).toBe(false);
};

// ── owner ─────────────────────────────────────────────────────────────────────

describe("owner", () => {
  it("has full access to all resources", () => {
    allowed("owner", "contacts", [
      "read",
      "write",
      "delete",
      "import",
      "export",
    ]);
    allowed("owner", "templates", ["read", "write", "publish", "delete"]);
    allowed("owner", "broadcasts", ["read", "write", "send", "delete"]);
    allowed("owner", "events", ["read", "export"]);
    allowed("owner", "workflows", ["read", "write", "delete"]);
    allowed("owner", "segments", ["read", "write", "delete"]);
    allowed("owner", "topics", ["read", "write", "delete"]);
    allowed("owner", "apiKeys", ["read", "write", "delete"]);
    allowed("owner", "awsAccounts", ["read", "write", "delete"]);
    allowed("owner", "members", ["read", "invite", "remove", "changeRole"]);
    allowed("owner", "sso", ["read", "write", "delete"]);
    allowed("owner", "orgSettings", ["read", "write"]);
    allowed("owner", "billing", ["read", "write"]);
  });
});

// ── admin ─────────────────────────────────────────────────────────────────────

describe("admin", () => {
  it("has the same full access as owner", () => {
    allowed("admin", "contacts", [
      "read",
      "write",
      "delete",
      "import",
      "export",
    ]);
    allowed("admin", "templates", ["read", "write", "publish", "delete"]);
    allowed("admin", "broadcasts", ["read", "write", "send", "delete"]);
    allowed("admin", "events", ["read", "export"]);
    allowed("admin", "workflows", ["read", "write", "delete"]);
    allowed("admin", "segments", ["read", "write", "delete"]);
    allowed("admin", "topics", ["read", "write", "delete"]);
    allowed("admin", "apiKeys", ["read", "write", "delete"]);
    allowed("admin", "awsAccounts", ["read", "write", "delete"]);
    allowed("admin", "members", ["read", "invite", "remove", "changeRole"]);
    allowed("admin", "sso", ["read", "write", "delete"]);
    allowed("admin", "orgSettings", ["read", "write"]);
    allowed("admin", "billing", ["read", "write"]);
  });
});

// ── member ────────────────────────────────────────────────────────────────────

describe("member", () => {
  it("has full content access", () => {
    allowed("member", "contacts", [
      "read",
      "write",
      "delete",
      "import",
      "export",
    ]);
    allowed("member", "templates", ["read", "write", "publish", "delete"]);
    allowed("member", "broadcasts", ["read", "write", "send", "delete"]);
    allowed("member", "events", ["read", "export"]);
    allowed("member", "workflows", ["read", "write", "delete"]);
    allowed("member", "segments", ["read", "write", "delete"]);
    allowed("member", "topics", ["read", "write", "delete"]);
  });

  it("can only read apiKeys, awsAccounts, and members — not write or delete", () => {
    allowed("member", "apiKeys", ["read"]);
    denied("member", "apiKeys", ["write"]);
    denied("member", "apiKeys", ["delete"]);

    allowed("member", "awsAccounts", ["read"]);
    denied("member", "awsAccounts", ["write"]);
    denied("member", "awsAccounts", ["delete"]);

    allowed("member", "members", ["read"]);
    denied("member", "members", ["invite"]);
    denied("member", "members", ["remove"]);
    denied("member", "members", ["changeRole"]);
  });

  it("has no access to sso, orgSettings, or billing", () => {
    denied("member", "sso", ["read"]);
    denied("member", "sso", ["write"]);
    denied("member", "orgSettings", ["read"]);
    denied("member", "orgSettings", ["write"]);
    denied("member", "billing", ["read"]);
    denied("member", "billing", ["write"]);
  });
});

// ── marketing ─────────────────────────────────────────────────────────────────

describe("marketing", () => {
  it("has full access to contacts, templates, broadcasts, and events", () => {
    allowed("marketing", "contacts", [
      "read",
      "write",
      "delete",
      "import",
      "export",
    ]);
    allowed("marketing", "templates", ["read", "write", "publish", "delete"]);
    allowed("marketing", "broadcasts", ["read", "write", "send", "delete"]);
    allowed("marketing", "events", ["read", "export"]);
  });

  it("can only read workflows, segments, and topics — not write or delete", () => {
    allowed("marketing", "workflows", ["read"]);
    denied("marketing", "workflows", ["write"]);
    denied("marketing", "workflows", ["delete"]);

    allowed("marketing", "segments", ["read"]);
    denied("marketing", "segments", ["write"]);
    denied("marketing", "segments", ["delete"]);

    allowed("marketing", "topics", ["read"]);
    denied("marketing", "topics", ["write"]);
    denied("marketing", "topics", ["delete"]);
  });

  it("can only read apiKeys, awsAccounts, and members", () => {
    allowed("marketing", "apiKeys", ["read"]);
    denied("marketing", "apiKeys", ["write"]);

    allowed("marketing", "awsAccounts", ["read"]);
    denied("marketing", "awsAccounts", ["write"]);

    allowed("marketing", "members", ["read"]);
    denied("marketing", "members", ["invite"]);
    denied("marketing", "members", ["remove"]);
  });

  it("has no access to sso, orgSettings, or billing", () => {
    denied("marketing", "sso", ["read"]);
    denied("marketing", "orgSettings", ["read"]);
    denied("marketing", "billing", ["read"]);
    denied("marketing", "billing", ["write"]);
  });
});

// ── read-only ─────────────────────────────────────────────────────────────────

describe("read-only", () => {
  it("can read all content resources", () => {
    allowed("read-only", "contacts", ["read"]);
    allowed("read-only", "templates", ["read"]);
    allowed("read-only", "broadcasts", ["read"]);
    allowed("read-only", "events", ["read"]);
    allowed("read-only", "workflows", ["read"]);
    allowed("read-only", "segments", ["read"]);
    allowed("read-only", "topics", ["read"]);
    allowed("read-only", "apiKeys", ["read"]);
    allowed("read-only", "awsAccounts", ["read"]);
    allowed("read-only", "members", ["read"]);
  });

  it("can export contacts but not import them", () => {
    allowed("read-only", "contacts", ["export"]);
    denied("read-only", "contacts", ["import"]);
  });

  it("cannot write or delete anything", () => {
    denied("read-only", "contacts", ["write"]);
    denied("read-only", "contacts", ["delete"]);
    denied("read-only", "templates", ["write"]);
    denied("read-only", "templates", ["publish"]);
    denied("read-only", "broadcasts", ["write"]);
    denied("read-only", "broadcasts", ["send"]);
    denied("read-only", "workflows", ["write"]);
    denied("read-only", "segments", ["write"]);
    denied("read-only", "topics", ["write"]);
    denied("read-only", "apiKeys", ["write"]);
    denied("read-only", "awsAccounts", ["write"]);
    denied("read-only", "members", ["invite"]);
    denied("read-only", "members", ["remove"]);
  });

  it("has no access to sso, orgSettings, or billing", () => {
    denied("read-only", "sso", ["read"]);
    denied("read-only", "orgSettings", ["read"]);
    denied("read-only", "billing", ["read"]);
  });
});

// ── billing ───────────────────────────────────────────────────────────────────

describe("billing", () => {
  it("has full billing access", () => {
    allowed("billing", "billing", ["read"]);
    allowed("billing", "billing", ["write"]);
  });

  it("can read members and orgSettings but not modify them", () => {
    allowed("billing", "members", ["read"]);
    denied("billing", "members", ["invite"]);
    denied("billing", "members", ["remove"]);
    denied("billing", "members", ["changeRole"]);

    allowed("billing", "orgSettings", ["read"]);
    denied("billing", "orgSettings", ["write"]);
  });

  it("has no access to content resources", () => {
    denied("billing", "contacts", ["read"]);
    denied("billing", "templates", ["read"]);
    denied("billing", "broadcasts", ["read"]);
    denied("billing", "events", ["read"]);
    denied("billing", "workflows", ["read"]);
    denied("billing", "segments", ["read"]);
    denied("billing", "topics", ["read"]);
    denied("billing", "apiKeys", ["read"]);
    denied("billing", "awsAccounts", ["read"]);
    denied("billing", "sso", ["read"]);
  });
});

// ── unknown role ──────────────────────────────────────────────────────────────

describe("unknown role", () => {
  it("denies all access for unrecognized role names", () => {
    denied("superadmin", "contacts", ["read"]);
    denied("", "billing", ["read"]);
    denied("guest", "members", ["read"]);
  });
});
