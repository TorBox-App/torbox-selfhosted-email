import { describe, expect, it } from "vitest";
import {
  aggregateByDate,
  gapFillDates,
  generateDateRange,
  toLocaleDateStr,
  validateTimezone,
} from "../analytics-utils";

describe("validateTimezone", () => {
  it("should return a valid IANA timezone as-is", () => {
    expect(validateTimezone("America/Denver")).toBe("America/Denver");
    expect(validateTimezone("Europe/London")).toBe("Europe/London");
    expect(validateTimezone("UTC")).toBe("UTC");
  });

  it("should fall back to UTC for invalid, null, or undefined", () => {
    expect(validateTimezone(null)).toBe("UTC");
    expect(validateTimezone(undefined)).toBe("UTC");
    expect(validateTimezone("")).toBe("UTC");
    expect(validateTimezone("Not/A/Timezone")).toBe("UTC");
  });
});

describe("toLocaleDateStr", () => {
  it("should return UTC date when no timezone given", () => {
    // 11pm Denver = 5am UTC next day
    const date = new Date("2026-04-10T05:00:00Z");
    expect(toLocaleDateStr(date)).toBe("2026-04-10");
    expect(toLocaleDateStr(date, "UTC")).toBe("2026-04-10");
  });

  it("should convert to user's local date", () => {
    // 5am UTC Apr 10 = 11pm MDT Apr 9
    const date = new Date("2026-04-10T05:00:00Z");
    expect(toLocaleDateStr(date, "America/Denver")).toBe("2026-04-09");
  });

  it("should handle positive UTC offsets", () => {
    // 11pm UTC Apr 9 = 9am JST Apr 10
    const date = new Date("2026-04-09T23:00:00Z");
    expect(toLocaleDateStr(date, "Asia/Tokyo")).toBe("2026-04-10");
  });
});

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

  it("should shift boundaries when timezone differs from UTC", () => {
    // 5am UTC Apr 10 = 11pm MDT Apr 9
    // 5am UTC Apr 8 = 11pm MDT Apr 7
    const start = new Date("2026-04-08T05:00:00Z");
    const end = new Date("2026-04-10T05:00:00Z");

    const utcRange = generateDateRange(start, end);
    const denverRange = generateDateRange(start, end, "America/Denver");

    // UTC: Apr 8, 9, 10 (3 days)
    expect(utcRange).toEqual(["2026-04-08", "2026-04-09", "2026-04-10"]);
    // Denver: Apr 7, 8, 9 (3 days, shifted back one day)
    expect(denverRange).toEqual(["2026-04-07", "2026-04-08", "2026-04-09"]);
  });

  it("should include today in user timezone when endTime is now-ish", () => {
    // Simulate 11pm Denver time = 5am UTC next day
    const end = new Date("2026-04-10T05:00:00Z");
    const start = new Date("2026-04-08T05:00:00Z");

    const range = generateDateRange(start, end, "America/Denver");
    expect(range.at(-1)).toBe("2026-04-09"); // "today" in Denver, not Apr 10
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

  it("should bucket timestamps by user timezone, not UTC", () => {
    // These timestamps are all Apr 10 in UTC
    // but in America/Denver (UTC-6), the first one is still Apr 9
    const timestamps = [
      new Date("2026-04-10T05:00:00Z"), // 11pm Apr 9 in Denver
      new Date("2026-04-10T12:00:00Z"), // 6am Apr 10 in Denver
      new Date("2026-04-10T18:00:00Z"), // 12pm Apr 10 in Denver
    ];
    const values = [10, 20, 30];

    const utcResult = aggregateByDate(timestamps, [values], ["sent"]);
    const denverResult = aggregateByDate(
      timestamps,
      [values],
      ["sent"],
      "America/Denver"
    );

    // UTC: all three on Apr 10
    expect(utcResult.get("2026-04-10")).toEqual({ sent: 60 });
    expect(utcResult.has("2026-04-09")).toBe(false);

    // Denver: first goes to Apr 9, other two to Apr 10
    expect(denverResult.get("2026-04-09")).toEqual({ sent: 10 });
    expect(denverResult.get("2026-04-10")).toEqual({ sent: 50 });
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

describe("end-to-end: aggregate + gap-fill with timezone", () => {
  it("should show today's data in user timezone, not shifted to tomorrow", () => {
    // Scenario: user in America/Denver, it's 11pm local (5am UTC next day)
    // They sent 5 emails today. Without timezone fix, these show up under
    // tomorrow's date in the chart, making today appear as 0.
    const timestamps = [
      new Date("2026-04-10T03:00:00Z"), // 9pm Apr 9 Denver
      new Date("2026-04-10T04:00:00Z"), // 10pm Apr 9 Denver
      new Date("2026-04-10T05:00:00Z"), // 11pm Apr 9 Denver
    ];
    const sentValues = [2, 1, 2];

    const tz = "America/Denver";
    const startTime = new Date("2026-04-08T06:00:00Z"); // Apr 8 midnight Denver
    const endTime = new Date("2026-04-10T05:30:00Z"); // Apr 9 11:30pm Denver

    const dailyMap = aggregateByDate(timestamps, [sentValues], ["sent"], tz);
    const dateRange = generateDateRange(startTime, endTime, tz);
    const filled = gapFillDates(dateRange, dailyMap, { sent: 0 });

    // "Today" in Denver is Apr 9 — all 5 emails should land there
    const apr9 = filled.find((d) => d.date === "2026-04-09");
    expect(apr9?.sent).toBe(5);

    // Apr 10 should NOT appear (it's tomorrow in Denver)
    const apr10 = filled.find((d) => d.date === "2026-04-10");
    expect(apr10).toBeUndefined();

    // Date range should end on Apr 9 (user's "today")
    expect(dateRange.at(-1)).toBe("2026-04-09");
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
