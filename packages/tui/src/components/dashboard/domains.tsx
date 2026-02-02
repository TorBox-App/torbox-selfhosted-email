import type { DomainStatus } from "../../types";
import { StatusBadge } from "../shared/status-badge";

type DomainsPanelProps = {
  domains: DomainStatus[];
};

export function DomainsPanel({ domains }: DomainsPanelProps) {
  return (
    <box flexDirection="column" width="100%">
      <text fg="#AAAAAA">
        <b>{"  DOMAINS"}</b>
      </text>
      <box border borderStyle="single" flexDirection="column">
        {domains.length === 0 && (
          <text fg="#888888">
            {
              "  No domains configured. Run `wraps email domains add` to add one."
            }
          </text>
        )}
        {domains.map((domain) => (
          <box flexDirection="row" gap={1} key={domain.name}>
            <text fg="#FFFFFF">{`  ${domain.name.padEnd(16)}`}</text>
            <text fg="#888888">DKIM </text>
            <StatusBadge status={domain.dkimStatus} />
            <text fg="#888888"> SPF </text>
            <StatusBadge status={domain.spfStatus} />
            <text fg="#888888"> DMARC </text>
            <StatusBadge status={domain.dmarcStatus} />
          </box>
        ))}
      </box>
    </box>
  );
}
