import type { AccountData, Timespan } from "../../types";
import { ActivityPanel } from "./activity";
import { DomainsPanel } from "./domains";
import { ServicesPanel } from "./services";

function QuickActions() {
  return (
    <box flexDirection="column" padding={1}>
      <text fg="#AAAAAA">
        <b>Quick Actions</b>
      </text>
      <text fg="#888888">{"──────────────"}</text>
      <text fg="#FFFFFF">[e] Email</text>
      <text fg="#FFFFFF">[t] Templates</text>
      <text fg="#FFFFFF">[w] Workflows</text>
      <text fg="#FFFFFF">[m] Monitoring</text>
      <text> </text>
      <text fg="#FFFFFF">[r] Refresh</text>
      <text fg="#FFFFFF">[q] Quit</text>
    </box>
  );
}

interface DashboardProps {
  data: AccountData;
  timespan: Timespan;
}

export function Dashboard({ data, timespan }: DashboardProps) {
  return (
    <box flexDirection="row" height="100%" width="100%">
      <box flexDirection="column" flexGrow={1}>
        <ServicesPanel data={data} />
        <DomainsPanel domains={data.domains} />
        <ActivityPanel
          events={data.events}
          quota={data.quota}
          timespan={timespan}
        />
      </box>
      <box flexDirection="column" width={28}>
        <QuickActions />
      </box>
    </box>
  );
}
