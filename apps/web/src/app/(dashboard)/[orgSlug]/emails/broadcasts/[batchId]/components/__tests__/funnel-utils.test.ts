import { describe, expect, it } from "vitest";
import {
  calculateFunnelStages,
  generateFunnelPath,
  generateFunnelSectionPaths,
} from "../funnel-utils";

describe("calculateFunnelStages", () => {
  it("returns 4 stages with correct widths and rates for email", () => {
    const stages = calculateFunnelStages({
      channel: "email",
      sent: 12_450,
      delivered: 12_380,
      opened: 4952,
      clicked: 1238,
      failed: 50,
      bounced: 20,
      complained: 2,
    });

    expect(stages).toHaveLength(4);

    // Sent stage: always 100% width
    expect(stages[0]).toEqual({
      label: "Sent",
      count: 12_450,
      widthPercent: 100,
      rate: null,
      issues: [{ label: "failed", count: 50 }],
    });

    // Delivered stage: width relative to sent
    expect(stages[1]).toEqual({
      label: "Delivered",
      count: 12_380,
      widthPercent: expect.closeTo(99.4, 0),
      rate: 99.4,
      issues: [
        { label: "bounced", count: 20 },
        { label: "complained", count: 2 },
      ],
    });

    // Opened stage: width relative to sent
    expect(stages[2]).toEqual({
      label: "Opened",
      count: 4952,
      widthPercent: expect.closeTo(39.8, 0),
      rate: 40.0,
      issues: [],
    });

    // Clicked stage: width relative to sent
    expect(stages[3]).toEqual({
      label: "Clicked",
      count: 1238,
      widthPercent: expect.closeTo(9.9, 0),
      rate: 25.0,
      issues: [],
    });
  });

  it("returns only 2 stages for SMS channel", () => {
    const stages = calculateFunnelStages({
      channel: "sms",
      sent: 5000,
      delivered: 4800,
      opened: 0,
      clicked: 0,
      failed: 100,
      bounced: 50,
      complained: 0,
    });

    expect(stages).toHaveLength(2);
    expect(stages[0]!.label).toBe("Sent");
    expect(stages[1]!.label).toBe("Delivered");
    expect(stages[1]!.widthPercent).toBe(96);
    expect(stages[1]!.rate).toBe(96);
  });

  it("handles zero sent gracefully", () => {
    const stages = calculateFunnelStages({
      channel: "email",
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      bounced: 0,
      complained: 0,
    });

    expect(stages).toHaveLength(4);
    for (const stage of stages) {
      expect(stage.count).toBe(0);
      expect(stage.widthPercent).toBe(stage.label === "Sent" ? 100 : 0);
    }
  });

  it("omits zero-count issues", () => {
    const stages = calculateFunnelStages({
      channel: "email",
      sent: 100,
      delivered: 100,
      opened: 50,
      clicked: 10,
      failed: 0,
      bounced: 0,
      complained: 0,
    });

    expect(stages[0]!.issues).toEqual([]);
    expect(stages[1]!.issues).toEqual([]);
  });
});

describe("generateFunnelPath", () => {
  it("produces a closed SVG path with bezier curves", () => {
    const widths = [100, 80, 40, 10];
    const path = generateFunnelPath(widths, { width: 800, height: 120 });

    // Must start with M (moveTo) and end with Z (close)
    expect(path).toMatch(/^M/);
    expect(path).toMatch(/Z$/);
    // Must contain cubic bezier commands
    expect(path).toContain("C");
  });

  it("returns empty string for single stage", () => {
    const path = generateFunnelPath([100], { width: 800, height: 120 });
    expect(path).toBe("");
  });
});

describe("generateFunnelSectionPaths", () => {
  it("returns one path per section (N-1 paths for N stages)", () => {
    const widths = [100, 80, 40, 10];
    const paths = generateFunnelSectionPaths(widths, {
      width: 800,
      height: 120,
    });

    expect(paths).toHaveLength(3);
    for (const p of paths) {
      expect(p).toMatch(/^M/);
      expect(p).toMatch(/Z$/);
      expect(p).toContain("C");
    }
  });

  it("returns empty array for fewer than 2 stages", () => {
    expect(
      generateFunnelSectionPaths([100], { width: 800, height: 120 })
    ).toEqual([]);
  });

  it("returns 1 path for 2 stages", () => {
    const paths = generateFunnelSectionPaths([100, 60], {
      width: 800,
      height: 120,
    });
    expect(paths).toHaveLength(1);
  });
});
