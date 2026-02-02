import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { useFocus } from "../../contexts/focus";
import type { AccountData, Route } from "../../types";
import { StatusBadge } from "../shared/status-badge";

interface EmailOverviewProps {
  data: AccountData;
  onNavigate: (route: Route) => void;
}

export function EmailOverview({ data, onNavigate }: EmailOverviewProps) {
  const { domains } = data;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { inputActive } = useFocus();

  const selectedDomain = domains[selectedIndex];

  useKeyboard((key) => {
    if (inputActive) return;

    if (key.name === "j" || key.name === "down") {
      setSelectedIndex((i) => Math.min(domains.length - 1, i + 1));
    }
    if (key.name === "k" || key.name === "up") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.name === "a") {
      onNavigate({ view: "email.domains.add" });
    }
    if (key.name === "v" && selectedDomain) {
      onNavigate({ view: "email.domains.verify", domain: selectedDomain.name });
    }
    if (key.name === "d" && selectedDomain) {
      onNavigate({ view: "email.domains.remove", domain: selectedDomain.name });
    }
    if (key.name === "i") {
      onNavigate({ view: "email.init" });
    }
  });

  const email = data.metadata?.services.email;

  return (
    <box flexDirection="column" padding={1} width="100%">
      {email && (
        <box flexDirection="row" gap={2} paddingBottom={1}>
          <text fg="#00AAFF">
            <b>Email</b>
          </text>
          <text fg="#888888">{capitalize(email.preset ?? "Custom")}</text>
          <text fg="#666666">{data.region}</text>
        </box>
      )}

      <text fg="#AAAAAA">
        <b>Domains</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>

      {domains.length === 0 ? (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#888888">No domains configured.</text>
          <text fg="#888888">
            Press <b>a</b> to add a domain.
          </text>
        </box>
      ) : (
        <box flexDirection="column">
          {domains.map((domain, i) => {
            const selected = i === selectedIndex;
            return (
              <box flexDirection="row" gap={1} key={domain.name}>
                <text fg={selected ? "#00AAFF" : "#666666"}>
                  {selected ? ">" : " "}
                </text>
                <text fg={selected ? "#FFFFFF" : "#AAAAAA"}>
                  {domain.name.padEnd(24)}
                </text>
                <text fg="#888888">DKIM </text>
                <StatusBadge status={domain.dkimStatus} />
                <text fg="#888888"> SPF </text>
                <StatusBadge status={domain.spfStatus} />
                <text fg="#888888"> DMARC </text>
                <StatusBadge status={domain.dmarcStatus} />
              </box>
            );
          })}
        </box>
      )}

      <box flexDirection="row" gap={3} paddingTop={1}>
        <text fg="#666666">
          <b>i</b> Deploy <b>a</b> Add <b>v</b> Verify <b>d</b> Remove{" "}
          <b>j/k</b> Navigate
        </text>
      </box>

      {!email && (
        <box paddingTop={1}>
          <text fg="#FFFF00">
            No email infrastructure deployed. Press <b>i</b> to set up.
          </text>
        </box>
      )}
    </box>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
