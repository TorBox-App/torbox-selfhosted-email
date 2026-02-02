import type { EmailEvent, SendStats, Timespan } from "../types";

const TIMESPAN_MS: Record<Timespan, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const TIMESPAN_LABELS: Record<Timespan, string> = {
  "24h": "last 24h",
  "7d": "last 7 days",
  "30d": "last 30 days",
};

export function aggregateStats(
  events: EmailEvent[],
  timespan: Timespan
): SendStats {
  const cutoff = Date.now() - TIMESPAN_MS[timespan];
  const recent = events.filter((e) => e.timestamp >= cutoff);

  const stats: SendStats = {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complaints: 0,
    rejected: 0,
  };

  for (const e of recent) {
    switch (e.eventType) {
      case "Send":
        stats.sent++;
        break;
      case "Delivery":
        stats.delivered++;
        break;
      case "Open":
        stats.opened++;
        break;
      case "Click":
        stats.clicked++;
        break;
      case "Bounce":
      case "Suppressed":
        stats.bounced++;
        break;
      case "Complaint":
        stats.complaints++;
        break;
      case "Reject":
        stats.rejected++;
        break;
    }
  }

  return stats;
}

export function getTimespanLabel(timespan: Timespan): string {
  return TIMESPAN_LABELS[timespan];
}
