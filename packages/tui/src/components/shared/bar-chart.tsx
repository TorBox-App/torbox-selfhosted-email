type BarChartEntry = {
  label: string;
  value: number;
  max: number;
  color: string;
};

type BarChartProps = {
  entries: BarChartEntry[];
  barWidth?: number;
};

export function BarChart({ entries, barWidth = 22 }: BarChartProps) {
  const maxLabel = Math.max(...entries.map((e) => e.label.length));

  return (
    <box flexDirection="column" gap={0}>
      {entries.map((entry) => {
        const ratio = entry.max > 0 ? entry.value / entry.max : 0;
        const filled = Math.min(Math.round(ratio * barWidth), barWidth);
        const empty = barWidth - filled;
        const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
        const label = entry.label.padEnd(maxLabel);
        const count = entry.value.toLocaleString().padStart(6);

        return (
          <box flexDirection="row" key={entry.label}>
            <text fg="#AAAAAA">{`  ${label}  `}</text>
            <text fg={entry.color}>{bar}</text>
            <text fg="#888888">{count}</text>
          </box>
        );
      })}
    </box>
  );
}
