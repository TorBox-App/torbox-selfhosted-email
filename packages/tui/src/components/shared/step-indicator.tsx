const STEP_LABELS = ["Welcome", "Config", "Features", "Review", "Deploy"];

interface StepIndicatorProps {
  currentIndex: number;
}

export function StepIndicator({ currentIndex }: StepIndicatorProps) {
  return (
    <box flexDirection="row">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        const prefix = isCompleted ? "✓ " : isCurrent ? "> " : "○ ";
        const fg = isCompleted ? "#00FF00" : isCurrent ? "#00AAFF" : "#555555";

        return (
          <box flexDirection="row" key={label}>
            {i > 0 && <text fg="#444444">{" ── "}</text>}
            <text fg={fg}>
              {isCurrent ? <b>{prefix + label}</b> : prefix + label}
            </text>
          </box>
        );
      })}
    </box>
  );
}
