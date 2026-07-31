/**
 * Partition validation parity
 *
 * The bucket bounds live in two places: validateBucketValue (apps/web, for the
 * form error message) and parseBucketValue (packages/db, gating SQL emission).
 * They can't share code — @/lib/segments is pulled into the client bundle and
 * must not import drizzle — so this test pins them to the same answer.
 *
 * The failure mode being guarded is asymmetric and severe: if the web validator
 * accepts a value the SQL builder rejects, buildFilterSQL returns null,
 * buildConditionSQL drops it, and a partitioned segment silently widens to
 * every contact in the org.
 */

import { buildFilterSQL, type SegmentFilter } from "@wraps/db";
import { describe, expect, it } from "vitest";
import { validateBucketValue } from "@/lib/segments";

const CASES: unknown[] = [
  { buckets: 6, index: 1 },
  { buckets: 6, index: 6 },
  { buckets: 2, index: 1 },
  { buckets: 1000, index: 1000 },
  { buckets: 6, index: 0 },
  { buckets: 6, index: 7 },
  { buckets: 6, index: -1 },
  { buckets: 1, index: 1 },
  { buckets: 0, index: 0 },
  { buckets: 1001, index: 1 },
  { buckets: 6.5, index: 1 },
  { buckets: 6, index: 1.5 },
  { buckets: Number.NaN, index: 1 },
  { buckets: 6 },
  { index: 1 },
  { buckets: "6", index: "1" },
  {},
  null,
  undefined,
  6,
  "6",
  [6, 1],
];

describe("partition validation parity", () => {
  it.each(CASES.map((value) => [JSON.stringify(value) ?? "undefined", value]))(
    "web validator and SQL builder agree on %s",
    (_label, value) => {
      const filter: SegmentFilter = {
        field: "bucket",
        operator: "inBucket",
        value,
      };

      const webAccepts = validateBucketValue(value) === null;
      const sqlAccepts = buildFilterSQL(filter) !== null;

      expect(webAccepts).toBe(sqlAccepts);
    }
  );

  it("never lets the web validator be the more permissive of the two", () => {
    const widening = CASES.filter(
      (value) =>
        validateBucketValue(value) === null &&
        buildFilterSQL({
          field: "bucket",
          operator: "inBucket",
          value,
        }) === null
    );

    expect(widening).toEqual([]);
  });
});
