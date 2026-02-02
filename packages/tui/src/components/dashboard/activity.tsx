import { aggregateStats, getTimespanLabel } from "../../lib/stats";
import type { EmailEvent, SendQuota, Timespan } from "../../types";
import { BarChart } from "../shared/bar-chart";

type ActivityPanelProps = {
  quota: SendQuota;
  events: EmailEvent[];
  timespan: Timespan;
};

export function ActivityPanel({ quota, events, timespan }: ActivityPanelProps) {
  const stats = aggregateStats(events, timespan);
  const sent = timespan === "24h" ? quota.sentLast24Hours : stats.sent;
  const max = Math.max(sent, stats.delivered, 1);

  const entries = [
    { label: "Sent", value: sent, max, color: "#00AAFF" },
    { label: "Delivered", value: stats.delivered, max, color: "#00FF00" },
    { label: "Opened", value: stats.opened, max, color: "#FFFFFF" },
    { label: "Clicked", value: stats.clicked, max, color: "#AA88FF" },
    { label: "Bounced", value: stats.bounced, max, color: "#FF4444" },
  ];

  const label = getTimespanLabel(timespan);

  return (
    <box flexDirection="column" width="100%">
      <text fg="#AAAAAA">
        <b>{`  ACTIVITY (${label})`}</b>
      </text>
      <box border borderStyle="single" flexDirection="column">
        <BarChart entries={entries} />
        <text fg="#666666">
          {`  Quota: ${quota.sentLast24Hours.toLocaleString()} / ${quota.max24HourSend.toLocaleString()}  Rate: ${quota.maxSendRate.toLocaleString()}/sec`}
        </text>
      </box>
    </box>
  );
}
