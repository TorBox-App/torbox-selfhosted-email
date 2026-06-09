import { describe, expect, it } from "vitest";
import { detectVolumeAnomalies } from "../insights-section";

type EmailPoint = {
  date: string;
  sent: number;
  delivered?: number;
  bounced?: number;
  renderingFailures?: number;
};

const findDelivery = (data: EmailPoint[]) =>
  detectVolumeAnomalies(data).find((a) => a.metric === "Email delivery rate");

describe("detectVolumeAnomalies — delivery rate", () => {
  it("excludes rendering failures from the denominator (no false drop)", () => {
    // Previous: 297/300 delivered = 99%. Current: same 297 delivered, but the
    // current half also had 30 rendering failures that never left SES. Dividing
    // by raw sends (330) would show 90% — an 9pp 'drop' that isn't real.
    const data: EmailPoint[] = [
      { date: "1", sent: 150, delivered: 149, renderingFailures: 0 },
      { date: "2", sent: 150, delivered: 148, renderingFailures: 0 },
      { date: "3", sent: 165, delivered: 149, renderingFailures: 15 },
      { date: "4", sent: 165, delivered: 148, renderingFailures: 15 },
    ];
    // Effective delivery rate is 99% in both halves → no anomaly.
    expect(findDelivery(data)).toBeUndefined();
  });

  it("ignores low-volume noise (the dogfood 98.7% → 86.4% case)", () => {
    // 149 then 110 sends — a 12.3pp swing, but on a few dozen sends it's noise.
    const data: EmailPoint[] = [
      { date: "1", sent: 75, delivered: 74, renderingFailures: 0 },
      { date: "2", sent: 74, delivered: 73, renderingFailures: 0 },
      { date: "3", sent: 55, delivered: 48, renderingFailures: 4 },
      { date: "4", sent: 55, delivered: 47, renderingFailures: 4 },
    ];
    expect(findDelivery(data)).toBeUndefined();
  });

  it("still fires critical on a genuine high-volume drop", () => {
    // 99% → 88% on 300 effective sends per half = real 11pp drop.
    const data: EmailPoint[] = [
      { date: "1", sent: 150, delivered: 149, renderingFailures: 0 },
      { date: "2", sent: 150, delivered: 148, renderingFailures: 0 },
      { date: "3", sent: 150, delivered: 132, renderingFailures: 0 },
      { date: "4", sent: 150, delivered: 132, renderingFailures: 0 },
    ];
    const anomaly = findDelivery(data);
    expect(anomaly?.severity).toBe("critical");
    expect(anomaly?.previous).toBeCloseTo(99, 0);
    expect(anomaly?.current).toBeCloseTo(88, 0);
  });
});
