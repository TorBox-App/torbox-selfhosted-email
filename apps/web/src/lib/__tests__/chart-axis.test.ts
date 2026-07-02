import { describe, expect, it } from "vitest";
import { countYAxisProps, createCountAxisFormatter } from "../chart-axis";

describe("createCountAxisFormatter", () => {
  it("formats as whole k above 100k", () => {
    const format = createCountAxisFormatter(250_000);
    expect(format(150_000)).toBe("150k");
    expect(format(0)).toBe("0k");
  });

  it("formats as one-decimal k between 10k and 100k", () => {
    const format = createCountAxisFormatter(45_000);
    expect(format(12_500)).toBe("12.5k");
  });

  it("formats as one-decimal k between 1k and 10k", () => {
    const format = createCountAxisFormatter(5000);
    expect(format(1500)).toBe("1.5k");
  });

  it("rounds to hundreds between 100 and 1k", () => {
    const format = createCountAxisFormatter(600);
    expect(format(340)).toBe("300");
  });

  it("rounds to tens between 10 and 100", () => {
    const format = createCountAxisFormatter(80);
    expect(format(47)).toBe("50");
  });

  it("rounds to integers below 10", () => {
    const format = createCountAxisFormatter(8);
    expect(format(3.4)).toBe("3");
  });

  it("switches buckets exactly at each threshold", () => {
    expect(createCountAxisFormatter(100_000)(100_000)).toBe("100k");
    expect(createCountAxisFormatter(10_000)(10_000)).toBe("10.0k");
    expect(createCountAxisFormatter(1000)(1000)).toBe("1.0k");
    expect(createCountAxisFormatter(100)(100)).toBe("100");
    expect(createCountAxisFormatter(10)(10)).toBe("10");
  });
});

describe("countYAxisProps", () => {
  it("carries the shared scaling system", () => {
    const props = countYAxisProps(5000);
    expect(props.scale).toBe("sqrt");
    expect(props.domain).toEqual([0, "auto"]);
    expect(props.axisLine).toBe(false);
    expect(props.tickLine).toBe(false);
    expect(props.tickMargin).toBe(8);
    expect(props.tickFormatter(1500)).toBe("1.5k");
  });
});
