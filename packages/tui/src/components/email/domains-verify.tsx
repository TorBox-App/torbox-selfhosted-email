import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import { useFocus } from "../../contexts/focus";
import { listDomains } from "../../lib/aws";
import { checkDomainDns } from "../../lib/dns";
import type { DomainStatus } from "../../types";
import { StatusBadge } from "../shared/status-badge";

interface DomainsVerifyProps {
  domain: string;
  region: string;
  onBack: () => void;
}

export function DomainsVerify({ domain, region, onBack }: DomainsVerifyProps) {
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { inputActive } = useFocus();

  const checkDns = useCallback(async () => {
    setLoading(true);
    try {
      const identities = await listDomains(region);
      const identity = identities.find((id) => id.name === domain);
      if (identity) {
        const result = await checkDomainDns(identity);
        setStatus(result);
      }
    } catch {
      // DNS check failed silently
    } finally {
      setLoading(false);
    }
  }, [domain, region]);

  useEffect(() => {
    checkDns();
  }, [checkDns]);

  useKeyboard((key) => {
    if (inputActive) return;

    if (key.name === "escape") {
      onBack();
    }
    if (key.name === "r") {
      checkDns();
    }
  });

  return (
    <box flexDirection="column" padding={1} width="100%">
      <text fg="#00AAFF">
        <b>Verify Domain: {domain}</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>

      {loading ? (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#FFFF00">Checking DNS records...</text>
        </box>
      ) : status ? (
        <box flexDirection="column" gap={1} paddingTop={1}>
          <box flexDirection="row" gap={2}>
            <text fg="#AAAAAA" width={12}>
              Verified
            </text>
            <text fg={status.verified ? "#00FF00" : "#FFFF00"}>
              {status.verified ? "Yes" : "No"}
            </text>
          </box>

          <box flexDirection="row" gap={2}>
            <text fg="#AAAAAA" width={12}>
              DKIM
            </text>
            <StatusBadge status={status.dkimStatus} />
            <text fg="#666666">
              {status.dkimStatus === "ok"
                ? "CNAME records configured"
                : "Waiting for CNAME records"}
            </text>
          </box>

          <box flexDirection="row" gap={2}>
            <text fg="#AAAAAA" width={12}>
              SPF
            </text>
            <StatusBadge status={status.spfStatus} />
            <text fg="#666666">
              {status.spfStatus === "ok"
                ? "include:amazonses.com present"
                : status.spfStatus === "error"
                  ? "SPF record missing amazonses.com"
                  : "Waiting for SPF record"}
            </text>
          </box>

          <box flexDirection="row" gap={2}>
            <text fg="#AAAAAA" width={12}>
              DMARC
            </text>
            <StatusBadge status={status.dmarcStatus} />
            <text fg="#666666">
              {status.dmarcStatus === "ok"
                ? "DMARC record found"
                : "Waiting for DMARC record"}
            </text>
          </box>

          {!status.verified && (
            <box flexDirection="column" paddingTop={1}>
              <text fg="#888888">
                DNS changes can take up to 72 hours to propagate.
              </text>
              <text fg="#888888">
                Press <b>r</b> to re-check.
              </text>
            </box>
          )}
        </box>
      ) : (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#FF4444">Domain not found in SES.</text>
        </box>
      )}

      <box flexDirection="row" gap={3} paddingTop={1}>
        <text fg="#666666">
          <b>r</b> Refresh <b>esc</b> Back
        </text>
      </box>
    </box>
  );
}
