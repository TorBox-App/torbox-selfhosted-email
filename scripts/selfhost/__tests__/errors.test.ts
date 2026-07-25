import { describe, expect, it } from "vitest";
import { describeError } from "../errors.js";
import { migrationHint } from "../migrate.js";

describe("describeError", () => {
  it("unwraps the pg error Drizzle hides behind 'Failed query'", () => {
    // Exactly what a self-hosted operator saw: a bare SQL statement, no reason.
    const pgError = Object.assign(
      new Error('permission denied for database "wraps"'),
      { code: "42501" }
    );
    const drizzleError = new Error(
      'Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"\nparams: '
    );
    drizzleError.cause = pgError;

    const described = describeError(drizzleError);

    expect(described).toContain('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    expect(described).toContain('permission denied for database "wraps"');
    expect(described).toContain("42501");
    // The `params:` line is noise, not a reason.
    expect(described).not.toContain("params:");
  });

  it("keeps multi-line messages intact for non-Drizzle errors", () => {
    const error = new Error("something broke\nhere is how to fix it");

    expect(describeError(error)).toBe("something broke\nhere is how to fix it");
  });

  it("walks a multi-level cause chain", () => {
    const root = new Error("ECONNREFUSED 10.0.0.1:5432");
    const middle = new Error("connection failed");
    middle.cause = root;
    const outer = new Error("migration aborted");
    outer.cause = middle;

    expect(describeError(outer)).toBe(
      "migration aborted — connection failed — ECONNREFUSED 10.0.0.1:5432"
    );
  });

  it("survives a self-referential cause instead of looping forever", () => {
    const error = new Error("loop");
    error.cause = error;

    expect(describeError(error)).toBe("loop");
  });

  it("stringifies non-Error throws", () => {
    expect(describeError("plain string")).toBe("plain string");
  });
});

describe("migrationHint", () => {
  it.each([
    ["password authentication failed (28P01)", /credentials in DATABASE_URL/],
    ["permission denied for database (42501)", /GRANT CREATE ON DATABASE/],
    ['database "wraps" does not exist (3D000)', /does not exist. Create it/],
    ["no pg_hba.conf entry for host", /sslmode=verify-full/],
    ["connect ECONNREFUSED 10.0.0.1:5432", /reach the database host/],
  ])("maps %s to an actionable fix", (description, expected) => {
    expect(migrationHint(description)).toMatch(expected);
  });

  it("maps a missing sslrootcert file to the trust-store fix", () => {
    expect(
      migrationHint("ENOENT: no such file or directory, open 'system'")
    ).toMatch(/sslrootcert/);
  });

  it("prefers the file hint over the GRANT hint when both patterns match", () => {
    // An unreadable CA file reports "permission denied", which must not be
    // diagnosed as a missing CREATE privilege on the database. This asserts the
    // HINTS ordering, not just the patterns.
    const description =
      "EACCES: permission denied, open '/etc/ssl/certs/ca.pem' (EACCES)";

    expect(migrationHint(description)).toMatch(/sslrootcert/);
    expect(migrationHint(description)).not.toMatch(/GRANT CREATE ON DATABASE/);
  });

  it("does not blame schema creation for an unrelated privilege error", () => {
    const hint = migrationHint(
      'permission denied for table "user" (42501)'
    ) as string;

    expect(hint).toMatch(/lacks a privilege/);
    expect(hint).not.toMatch(/GRANT CREATE ON DATABASE/);
  });

  it("returns nothing for failures it cannot advise on", () => {
    expect(migrationHint("syntax error at or near FOO")).toBeUndefined();
  });
});
