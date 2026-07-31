/**
 * Partition composition
 *
 * withPartitionFilter has to AND a partition onto an arbitrary condition while
 * keeping the result flat — the segment builder and details sheet do not render
 * FilterGroup.nested, so a nested encoding would hide the source filters from
 * the UI while they still applied in SQL.
 *
 * The OR case is the dangerous one. Appending a group to an OR condition yields
 * A ∨ B ∨ P, which matches everyone in the partition regardless of the source
 * filters — a partition of "engaged users" would quietly become a sixth of the
 * entire list. These tests assert the SQL, not just the shape.
 */

import { buildConditionSQL } from "@wraps/db";
import { describe, expect, it } from "vitest";
import {
  conditionHasPartitionFilter,
  type FilterCondition,
  withPartitionFilter,
} from "@/lib/segments";

const pgConfig = {
  escapeName: (name: string) => `"${name}"`,
  escapeParam: (num: number) => `$${num}`,
  escapeString: (str: string) => `'${str.replace(/'/g, "''")}'`,
  // biome-ignore lint/suspicious/noExplicitAny: drizzle dialect stub for tests
} as any;

function toSQL(condition: FilterCondition) {
  const built = buildConditionSQL(condition);
  expect(built).not.toBeNull();
  // biome-ignore lint/suspicious/noExplicitAny: drizzle internal builder
  return (built as any).toQuery(pgConfig) as {
    sql: string;
    params: unknown[];
  };
}

const andSource: FilterCondition = {
  logic: "AND",
  groups: [
    {
      filters: [
        { field: "status", operator: "equals", value: "active" },
        { field: "emailsOpened", operator: "greaterThan", value: 3 },
      ],
    },
  ],
};

const orSource: FilterCondition = {
  logic: "OR",
  groups: [
    { filters: [{ field: "status", operator: "equals", value: "active" }] },
    { filters: [{ field: "emailsOpened", operator: "greaterThan", value: 3 }] },
  ],
};

describe("withPartitionFilter", () => {
  it("keeps AND logic and appends the partition as its own group", () => {
    const result = withPartitionFilter(andSource, 6, 2);

    expect(result.logic).toBe("AND");
    expect(result.groups).toHaveLength(2);
    expect(result.groups[1].filters).toHaveLength(1);
    expect(result.groups[1].filters[0]).toMatchObject({
      field: "bucket",
      operator: "inBucket",
      value: { buckets: 6, index: 2 },
    });
  });

  it("distributes the partition into every group of an OR condition", () => {
    const result = withPartitionFilter(orSource, 6, 2);

    expect(result.logic).toBe("OR");
    expect(result.groups).toHaveLength(2);
    for (const group of result.groups) {
      expect(
        group.filters.filter((f) => f.operator === "inBucket")
      ).toHaveLength(1);
    }
  });

  it("does not add a standalone partition group to an OR condition", () => {
    // The bug this guards: a group containing ONLY the partition filter would
    // OR in every contact of that partition, ignoring the source filters.
    const result = withPartitionFilter(orSource, 6, 2);

    const partitionOnlyGroups = result.groups.filter(
      (g) => g.filters.length === 1 && g.filters[0].operator === "inBucket"
    );
    expect(partitionOnlyGroups).toEqual([]);
  });

  it("constrains an OR source rather than widening it", () => {
    const before = toSQL(orSource);
    const after = toSQL(withPartitionFilter(orSource, 6, 2));

    // Both source predicates survive, and the hash appears once per OR branch —
    // proof it is ANDed into each rather than sitting alongside them.
    expect(after.sql).toContain("status");
    expect(after.sql).toContain("emails_opened");
    expect(after.sql.split("md5").length - 1).toBe(2);
    expect(before.sql).not.toContain("md5");
  });

  it("ANDs a single hash expression into an AND source", () => {
    const after = toSQL(withPartitionFilter(andSource, 6, 2));

    expect(after.sql).toContain("status");
    expect(after.sql).toContain("emails_opened");
    expect(after.sql.split("md5").length - 1).toBe(1);
  });

  it("produces a compilable condition for every partition index", () => {
    for (let index = 1; index <= 6; index++) {
      expect(
        buildConditionSQL(withPartitionFilter(andSource, 6, index))
      ).not.toBeNull();
    }
  });

  it("does not mutate the source condition", () => {
    const snapshot = JSON.stringify(andSource);
    withPartitionFilter(andSource, 6, 2);
    expect(JSON.stringify(andSource)).toBe(snapshot);
  });
});

describe("conditionHasPartitionFilter", () => {
  it("is false for a plain condition", () => {
    expect(conditionHasPartitionFilter(andSource)).toBe(false);
    expect(conditionHasPartitionFilter(orSource)).toBe(false);
  });

  it("is true once a partition has been applied", () => {
    expect(
      conditionHasPartitionFilter(withPartitionFilter(andSource, 6, 1))
    ).toBe(true);
    expect(
      conditionHasPartitionFilter(withPartitionFilter(orSource, 6, 1))
    ).toBe(true);
  });

  it("finds a partition filter inside a nested condition", () => {
    expect(
      conditionHasPartitionFilter({
        logic: "AND",
        groups: [
          {
            filters: [{ field: "status", operator: "equals", value: "active" }],
            nested: withPartitionFilter(andSource, 6, 1),
          },
        ],
      })
    ).toBe(true);
  });
});
