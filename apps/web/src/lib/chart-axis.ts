import type { YAxisProps } from "recharts";

export function createCountAxisFormatter(maxValue: number) {
  if (maxValue >= 100_000) {
    return (value: number) => `${Math.round(value / 1000)}k`;
  }
  if (maxValue >= 10_000) {
    return (value: number) => `${(value / 1000).toFixed(1)}k`;
  }
  if (maxValue >= 1000) {
    return (value: number) => `${(value / 1000).toFixed(1)}k`;
  }
  if (maxValue >= 100) {
    return (value: number) => `${Math.round(value / 100) * 100}`;
  }
  if (maxValue >= 10) {
    return (value: number) => `${Math.round(value / 10) * 10}`;
  }
  return (value: number) => `${Math.round(value)}`;
}

// Shared Y-axis scaling for count-based charts: sqrt keeps low-volume days
// visible next to spikes. Rate/percentage charts must stay linear.
export function countYAxisProps(maxValue: number) {
  return {
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
    scale: "sqrt",
    domain: [0, "auto"],
    tickFormatter: createCountAxisFormatter(maxValue),
  } satisfies YAxisProps;
}
