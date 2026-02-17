import { describe, expect, it } from "vitest";
import {
  aggregateByDate,
  gapFillDates,
  generateDateRange,
} from "../analytics-utils";

describe("generateDateRange", () => {
  it("should include both start and end dates", () => {
    const start = new Date("2026-02-10T00:00:00Z");
    const end = new Date("2026-02-12T23:59:59Z");
    const range = generateDateRange(start, end);

    expect(range).toEqual(["2026-02-10", "2026-02-11", "2026-02-12"]);
  });

  it("should return a single date when start equals end", () => {
    const date = new Date("2026-02-17T15:30:00Z");
    const range = generateDateRange(date, date);

    expect(range).toEqual(["2026-02-17"]);
  });

  it("should include today when endTime is now", () => {
    const now = new Date();
    const start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const range = generateDateRange(start, now);
    const todayStr = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )
      .toISOString()
      .split("T")[0];

    expect(range.at(-1)).toBe(todayStr);
    expect(range.length).toBeGreaterThanOrEqual(3);
  });

  it("should handle month boundaries", () => {
    const start = new Date("2026-01-30T00:00:00Z");
    const end = new Date("2026-02-02T00:00:00Z");
    const range = generateDateRange(start, end);

    expect(range).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  it("should produce correct count for 7-day range", () => {
    const end = new Date("2026-02-17T12:00:00Z");
    const start = new Date("2026-02-10T12:00:00Z");
    const range = generateDateRange(start, end);

    expect(range).toHaveLength(8); // 10th through 17th inclusive
  });

  it("should use UTC date components consistently", () => {
    // Create dates that span a UTC day boundary
    // Feb 17 00:00 UTC to Feb 17 23:59 UTC should be exactly one date
    const start = new Date("2026-02-17T00:00:00Z");
    const end = new Date("2026-02-17T23:59:59Z");
    const range = generateDateRange(start, end);

    expect(range).toHaveLength(1);
    expect(range[0]).toBe("2026-02-17");
  });

  it("should return empty-ish for inverted range", () => {
    const start = new Date("2026-02-17T00:00:00Z");
    const end = new Date("2026-02-15T00:00:00Z");
    const range = generateDateRange(start, end);

    expect(range).toHaveLength(0);
  });
});

describe("aggregateByDate", () => {
  it("should aggregate sub-day timestamps into daily totals", () => {
    const timestamps = [
      new Date("2026-02-17T00:00:00Z"),
      new Date("2026-02-17T06:00:00Z"),
      new Date("2026-02-17T12:00:00Z"),
      new Date("2026-02-17T18:00:00Z"),
    ];
    const sentValues = [10, 20, 30, 40];
    const deliveredValues = [9, 18, 28, 38];

    const result = aggregateByDate(
      timestamps,
      [sentValues, deliveredValues],
      ["sent", "delivered"]
    );

    expect(result.get("2026-02-17")).toEqual({
      sent: 100,
      delivered: 93,
    });
  });

  it("should separate different dates", () => {
    const timestamps = [
      new Date("2026-02-16T12:00:00Z"),
      new Date("2026-02-17T06:00:00Z"),
      new Date("2026-02-17T18:00:00Z"),
    ];
    const values = [5, 10, 15];

    const result = aggregateByDate(timestamps, [values], ["count"]);

    expect(result.get("2026-02-16")).toEqual({ count: 5 });
    expect(result.get("2026-02-17")).toEqual({ count: 25 });
  });

  it("should handle empty input", () => {
    const result = aggregateByDate([], [[]], ["sent"]);
    expect(result.size).toBe(0);
  });

  it("should handle missing values with zero defaults", () => {
    const timestamps = [
      new Date("2026-02-17T00:00:00Z"),
      new Date("2026-02-17T06:00:00Z"),
    ];
    // sentValues has 2 entries, deliveredValues has only 1
    const sentValues = [10, 20];
    const deliveredValues = [9];

    const result = aggregateByDate(
      timestamps,
      [sentValues, deliveredValues],
      ["sent", "delivered"]
    );

    expect(result.get("2026-02-17")).toEqual({
      sent: 30,
      delivered: 9, // second entry defaults to 0
    });
  });

  it("should aggregate across multiple accounts (called multiple times)", () => {
    // Simulate merging data from two AWS accounts
    const map = aggregateByDate(
      [new Date("2026-02-17T00:00:00Z")],
      [[10]],
      ["sent"]
    );

    // Second account's data for same date
    const existing = map.get("2026-02-17")!;
    existing.sent += 5;

    expect(map.get("2026-02-17")).toEqual({ sent: 15 });
  });
});

describe("gapFillDates", () => {
  it("should fill missing dates with defaults", () => {
    const dateRange = ["2026-02-15", "2026-02-16", "2026-02-17"];
    const dataMap = new Map([["2026-02-16", { sent: 10, delivered: 9 }]]);
    const defaults = { sent: 0, delivered: 0 };

    const result = gapFillDates(dateRange, dataMap, defaults);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      date: "2026-02-15",
      timestamp: new Date("2026-02-15").getTime(),
      sent: 0,
      delivered: 0,
    });
    expect(result[1]).toEqual({
      date: "2026-02-16",
      timestamp: new Date("2026-02-16").getTime(),
      sent: 10,
      delivered: 9,
    });
    expect(result[2]).toEqual({
      date: "2026-02-17",
      timestamp: new Date("2026-02-17").getTime(),
      sent: 0,
      delivered: 0,
    });
  });

  it("should preserve existing data and add date/timestamp", () => {
    const dateRange = ["2026-02-17"];
    const dataMap = new Map([
      ["2026-02-17", { bounces: 3, complaints: 1, sent: 100 }],
    ]);
    const defaults = { bounces: 0, complaints: 0, sent: 0 };

    const result = gapFillDates(dateRange, dataMap, defaults);

    expect(result[0].bounces).toBe(3);
    expect(result[0].complaints).toBe(1);
    expect(result[0].sent).toBe(100);
    expect(result[0].date).toBe("2026-02-17");
    expect(result[0].timestamp).toBe(new Date("2026-02-17").getTime());
  });

  it("should return sorted results matching dateRange order", () => {
    const dateRange = ["2026-02-15", "2026-02-16", "2026-02-17"];
    const dataMap = new Map<string, { count: number }>();
    const defaults = { count: 0 };

    const result = gapFillDates(dateRange, dataMap, defaults);
    const dates = result.map((r) => r.date);

    expect(dates).toEqual(["2026-02-15", "2026-02-16", "2026-02-17"]);
  });

  it("should handle empty date range", () => {
    const result = gapFillDates([], new Map(), { count: 0 });
    expect(result).toHaveLength(0);
  });

  it("should handle all dates having data (no gaps)", () => {
    const dateRange = ["2026-02-16", "2026-02-17"];
    const dataMap = new Map([
      ["2026-02-16", { sent: 5 }],
      ["2026-02-17", { sent: 10 }],
    ]);

    const result = gapFillDates(dateRange, dataMap, { sent: 0 });

    expect(result[0].sent).toBe(5);
    expect(result[1].sent).toBe(10);
  });
});

describe("end-to-end: aggregate + gap-fill", () => {
  it("should produce a complete daily series from sub-day CloudWatch data", () => {
    // Simulate 3 days of CloudWatch data with 6-hour periods
    // Day 1: 4 data points, Day 2: no data, Day 3 (today): 2 data points
    const timestamps = [
      new Date("2026-02-15T00:00:00Z"),
      new Date("2026-02-15T06:00:00Z"),
      new Date("2026-02-15T12:00:00Z"),
      new Date("2026-02-15T18:00:00Z"),
      new Date("2026-02-17T00:00:00Z"),
      new Date("2026-02-17T06:00:00Z"),
    ];
    const sentValues = [3, 5, 2, 4, 8, 2];
    const deliveredValues = [3, 4, 2, 4, 7, 2];

    // Step 1: aggregate to daily
    const dailyMap = aggregateByDate(
      timestamps,
      [sentValues, deliveredValues],
      ["sent", "delivered"]
    );

    expect(dailyMap.get("2026-02-15")).toEqual({ sent: 14, delivered: 13 });
    expect(dailyMap.has("2026-02-16")).toBe(false); // no data
    expect(dailyMap.get("2026-02-17")).toEqual({ sent: 10, delivered: 9 });

    // Step 2: gap-fill
    const startTime = new Date("2026-02-15T00:00:00Z");
    const endTime = new Date("2026-02-17T12:00:00Z");
    const dateRange = generateDateRange(startTime, endTime);
    const filled = gapFillDates(dateRange, dailyMap, {
      sent: 0,
      delivered: 0,
    });

    expect(filled).toHaveLength(3);
    expect(filled[0]).toMatchObject({
      date: "2026-02-15",
      sent: 14,
      delivered: 13,
    });
    expect(filled[1]).toMatchObject({
      date: "2026-02-16",
      sent: 0,
      delivered: 0,
    });
    expect(filled[2]).toMatchObject({
      date: "2026-02-17",
      sent: 10,
      delivered: 9,
    });
  });
});
