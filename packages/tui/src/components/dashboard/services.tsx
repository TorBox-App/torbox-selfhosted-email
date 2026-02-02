import type { AccountData } from "../../types";

type ServicesPanelProps = {
  data: AccountData;
};

const TIER_COLORS: Record<string, string> = {
  starter: "#FFFF00",
  production: "#00FF00",
  enterprise: "#00AAFF",
  custom: "#AAAAAA",
};

export function ServicesPanel({ data }: ServicesPanelProps) {
  const email = data.metadata?.services.email;
  const sms = data.metadata?.services.sms;

  const hasServices = email || sms;

  return (
    <box flexDirection="column" width="100%">
      <text fg="#AAAAAA">
        <b>{"  SERVICES"}</b>
      </text>
      <box border borderStyle="single" flexDirection="column">
        {!hasServices && (
          <text fg="#888888">
            {"  No services deployed. Run `wraps email init` to get started."}
          </text>
        )}
        {email && (
          <>
            <box flexDirection="row" gap={2}>
              <text fg="#00AAFF">
                <b>Email</b>
              </text>
              <text fg={TIER_COLORS[email.preset ?? "custom"] ?? "#AAAAAA"}>
                {capitalize(email.preset ?? "Custom")}
              </text>
              <text fg="#888888">{data.region}</text>
            </box>
            <box flexDirection="row" gap={2}>
              <text fg="#888888">
                {`        ${data.domains.length} domain${data.domains.length !== 1 ? "s" : ""}    ${formatNumber(data.quota.sentLast24Hours)} sent today`}
              </text>
            </box>
          </>
        )}
        {email && sms && <text> </text>}
        {sms && (
          <box flexDirection="row" gap={2}>
            <text fg="#00AAFF">
              <b>SMS</b>
            </text>
            <text fg={TIER_COLORS[sms.preset ?? "custom"] ?? "#AAAAAA"}>
              {capitalize(sms.preset ?? "Custom")}
            </text>
            <text fg="#888888">{data.region}</text>
          </box>
        )}
      </box>
    </box>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toString();
}
