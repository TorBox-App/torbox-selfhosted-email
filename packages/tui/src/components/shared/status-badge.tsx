type Status = "ok" | "pending" | "error";

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  ok: { label: "OK", color: "#00FF00" },
  pending: { label: "..", color: "#FFFF00" },
  error: { label: "ERR", color: "#FF4444" },
};

type StatusBadgeProps = {
  status: Status;
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <text fg={config.color}>{label ?? config.label}</text>;
}
