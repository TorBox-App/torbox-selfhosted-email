/**
 * Segment Filter — Interval Injection Tests
 *
 * Verifies that the `within` and `triggeredWithin` operators validate
 * timeValue and unit inputs to prevent SQL injection or query crashes
 * via malicious INTERVAL strings.
 */

import type { SegmentFilter } from "@wraps/db";
import { buildFilterSQL } from "@wraps/db";
import { describe, expect, it } from "vitest";

// Helper to serialize drizzle SQL to string for assertions
// biome-ignore lint/suspicious/noExplicitAny: test helper
const pgConfig: any = {
  escapeName: (name: string) => `"${name}"`,
  escapeParam: (num: number, _value: unknown) => `$${num}`,
  escapeString: (str: string) => `'${str.replace(/'/g, "''")}'`,
};

function toSQL(sqlObj: ReturnType<typeof buildFilterSQL>) {
  if (!sqlObj) return null;
  return sqlObj.toQuery(pgConfig);
}

describe("buildFilterSQL — interval injection prevention", () => {
  it("returns null for within operator with non-numeric value", () => {
    const filter: SegmentFilter = {
      field: "lastActivityAt",
      operator: "within",
      value: "1; DROP TABLE contact; --",
      unit: "days",
    };

    const result = buildFilterSQL(filter);
    expect(result).toBeNull();
  });

  it("returns null for within operator with negative value", () => {
    const filter: SegmentFilter = {
      field: "lastActivityAt",
      operator: "within",
      value: -5,
      unit: "days",
    };

    const result = buildFilterSQL(filter);
    expect(result).toBeNull();
  });

  it("returns null for within operator with zero value", () => {
    const filter: SegmentFilter = {
      field: "lastActivityAt",
      operator: "within",
      value: 0,
      unit: "days",
    };

    const result = buildFilterSQL(filter);
    expect(result).toBeNull();
  });

  it("returns null for within operator with invalid unit", () => {
    const filter = {
      field: "lastActivityAt",
      operator: "within",
      value: 5,
      unit: "'; DROP TABLE contact; --",
    } as unknown as SegmentFilter;

    const result = buildFilterSQL(filter);
    expect(result).toBeNull();
  });

  it("returns null for triggeredWithin with non-numeric value", () => {
    const filter: SegmentFilter = {
      field: "email_opened",
      operator: "triggeredWithin",
      value: "malicious",
      unit: "days",
    };

    const result = buildFilterSQL(filter);
    expect(result).toBeNull();
  });

  it("returns null for triggeredWithin with invalid unit", () => {
    const filter = {
      field: "email_opened",
      operator: "triggeredWithin",
      value: 7,
      unit: "centuries",
    } as unknown as SegmentFilter;

    const result = buildFilterSQL(filter);
    expect(result).toBeNull();
  });

  it("accepts valid within filter with positive integer and valid unit", () => {
    const filter: SegmentFilter = {
      field: "lastActivityAt",
      operator: "within",
      value: 30,
      unit: "days",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("INTERVAL");
  });

  it("accepts valid triggeredWithin with positive integer and valid unit", () => {
    const filter: SegmentFilter = {
      field: "email_opened",
      operator: "triggeredWithin",
      value: 24,
      unit: "hours",
    };

    const result = buildFilterSQL(filter);
    expect(result).not.toBeNull();

    const query = toSQL(result);
    expect(query!.sql).toContain("INTERVAL");
  });
});
