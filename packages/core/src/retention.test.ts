import { describe, expect, it } from "vitest";
import {
  calculateTTL,
  retentionToAWSPeriod,
  retentionToDays,
} from "./retention.js";
import type { ArchiveRetention } from "./types.js";

describe("retentionToDays", () => {
  it("converts day-based retention values", () => {
    expect(retentionToDays("7days")).toBe(7);
    expect(retentionToDays("30days")).toBe(30);
    expect(retentionToDays("90days")).toBe(90);
  });

  it("converts month-based retention values", () => {
    expect(retentionToDays("3months")).toBe(90);
    expect(retentionToDays("6months")).toBe(180);
    expect(retentionToDays("9months")).toBe(270);
    expect(retentionToDays("18months")).toBe(548);
    expect(retentionToDays("30months")).toBe(913);
  });

  it("converts year-based retention values", () => {
    expect(retentionToDays("1year")).toBe(365);
    expect(retentionToDays("2years")).toBe(730);
    expect(retentionToDays("3years")).toBe(1095);
    expect(retentionToDays("4years")).toBe(1460);
    expect(retentionToDays("5years")).toBe(1825);
    expect(retentionToDays("6years")).toBe(2190);
    expect(retentionToDays("7years")).toBe(2555);
    expect(retentionToDays("8years")).toBe(2920);
    expect(retentionToDays("9years")).toBe(3285);
    expect(retentionToDays("10years")).toBe(3650);
  });

  it("returns -1 for permanent retention", () => {
    expect(retentionToDays("indefinite")).toBe(-1);
    expect(retentionToDays("permanent")).toBe(-1);
  });

  it("defaults to 90 days for unknown values", () => {
    expect(retentionToDays("unknown" as ArchiveRetention)).toBe(90);
  });
});

describe("retentionToAWSPeriod", () => {
  it("converts month-based retention to AWS enum", () => {
    expect(retentionToAWSPeriod("3months")).toBe("THREE_MONTHS");
    expect(retentionToAWSPeriod("6months")).toBe("SIX_MONTHS");
    expect(retentionToAWSPeriod("9months")).toBe("NINE_MONTHS");
    expect(retentionToAWSPeriod("18months")).toBe("EIGHTEEN_MONTHS");
    expect(retentionToAWSPeriod("30months")).toBe("THIRTY_MONTHS");
  });

  it("converts year-based retention to AWS enum", () => {
    expect(retentionToAWSPeriod("1year")).toBe("ONE_YEAR");
    expect(retentionToAWSPeriod("2years")).toBe("TWO_YEARS");
    expect(retentionToAWSPeriod("3years")).toBe("THREE_YEARS");
    expect(retentionToAWSPeriod("4years")).toBe("FOUR_YEARS");
    expect(retentionToAWSPeriod("5years")).toBe("FIVE_YEARS");
    expect(retentionToAWSPeriod("6years")).toBe("SIX_YEARS");
    expect(retentionToAWSPeriod("7years")).toBe("SEVEN_YEARS");
    expect(retentionToAWSPeriod("8years")).toBe("EIGHT_YEARS");
    expect(retentionToAWSPeriod("9years")).toBe("NINE_YEARS");
    expect(retentionToAWSPeriod("10years")).toBe("TEN_YEARS");
  });

  it("returns PERMANENT for permanent retention", () => {
    expect(retentionToAWSPeriod("permanent")).toBe("PERMANENT");
    expect(retentionToAWSPeriod("indefinite")).toBe("PERMANENT");
  });

  it("defaults to THREE_MONTHS for unknown values", () => {
    expect(retentionToAWSPeriod("unknown" as ArchiveRetention)).toBe(
      "THREE_MONTHS"
    );
    expect(retentionToAWSPeriod("7days")).toBe("THREE_MONTHS");
    expect(retentionToAWSPeriod("30days")).toBe("THREE_MONTHS");
    expect(retentionToAWSPeriod("90days")).toBe("THREE_MONTHS");
  });
});

describe("calculateTTL", () => {
  it("returns undefined for permanent retention (negative days)", () => {
    expect(calculateTTL(-1)).toBeUndefined();
    expect(calculateTTL(-100)).toBeUndefined();
  });

  it("calculates TTL in seconds for positive retention days", () => {
    const now = Math.floor(Date.now() / 1000);
    const ttl90 = calculateTTL(90);
    const ttl365 = calculateTTL(365);

    // TTL should be approximately now + retentionDays * 86400 seconds
    expect(ttl90).toBeDefined();
    expect(ttl90).toBeGreaterThan(now);
    expect(ttl90).toBeLessThanOrEqual(now + 90 * 86_400 + 1); // +1 for timing tolerance

    expect(ttl365).toBeDefined();
    expect(ttl365).toBeGreaterThan(now);
    expect(ttl365).toBeLessThanOrEqual(now + 365 * 86_400 + 1);
  });

  it("handles zero retention days", () => {
    const now = Math.floor(Date.now() / 1000);
    const ttl = calculateTTL(0);

    expect(ttl).toBeDefined();
    // TTL should be approximately now (0 days retention)
    expect(ttl).toBeGreaterThanOrEqual(now - 1);
    expect(ttl).toBeLessThanOrEqual(now + 1);
  });
});
