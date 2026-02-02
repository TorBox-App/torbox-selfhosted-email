import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import { useFocus } from "../../contexts/focus";
import { type CreateDomainResult, createDomain } from "../../lib/aws";

type DomainsAddProps = {
  region: string;
  onBack: () => void;
  onComplete: () => void;
};

type Phase = "input" | "creating" | "success" | "error";

export function DomainsAdd({ region, onBack, onComplete }: DomainsAddProps) {
  const [domain, setDomain] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<CreateDomainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setInputActive } = useFocus();

  useEffect(() => {
    setInputActive(phase === "input");
    return () => setInputActive(false);
  }, [phase, setInputActive]);

  const handleSubmit = useCallback(async () => {
    const trimmed = domain.trim();
    if (!trimmed) {
      return;
    }

    setPhase("creating");
    try {
      const res = await createDomain(region, trimmed);
      setResult(res);
      setPhase("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create domain");
      setPhase("error");
    }
  }, [domain, region]);

  useKeyboard((key) => {
    if (phase === "input") {
      if (key.name === "enter") {
        handleSubmit();
      }
      if (key.name === "escape") {
        onBack();
      }
    }
    if (
      (phase === "success" || phase === "error") &&
      (key.name === "escape" || key.name === "enter")
    ) {
      if (phase === "success") {
        onComplete();
      } else {
        onBack();
      }
    }
  });

  return (
    <box flexDirection="column" padding={1} width="100%">
      <text fg="#00AAFF">
        <b>Add Domain</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>

      {phase === "input" && (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#AAAAAA">
            Enter the domain you want to send emails from:
          </text>
          <box flexDirection="row" gap={1} paddingTop={1}>
            <text fg="#888888">Domain:</text>
            <input
              backgroundColor="#1a1a1a"
              cursorColor="#00AAFF"
              focused={true}
              focusedBackgroundColor="#222222"
              onChange={setDomain}
              placeholder="example.com"
              placeholderColor="#555555"
              textColor="#FFFFFF"
              value={domain}
              width={40}
            />
          </box>
          <text fg="#666666" paddingTop={1}>
            Press enter to submit, escape to cancel
          </text>
        </box>
      )}

      {phase === "creating" && (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#FFFF00">
            Creating email identity for {domain.trim()}...
          </text>
        </box>
      )}

      {phase === "success" && result && (
        <box flexDirection="column" gap={1} paddingTop={1}>
          <text fg="#00FF00">
            <b>Domain created successfully!</b>
          </text>
          <text> </text>
          <text fg="#AAAAAA">
            Configure these DNS records to verify <b>{result.name}</b>:
          </text>
          <text> </text>
          <text fg="#FFFFFF">
            <b>DKIM Records (CNAME)</b>
          </text>
          {result.dkimTokens.map((token) => (
            <box flexDirection="column" key={token}>
              <text fg="#888888">{`  ${token}._domainkey.${result.name}`}</text>
              <text fg="#00AAFF">{`  → ${token}.dkim.amazonses.com`}</text>
            </box>
          ))}
          <text> </text>
          <text fg="#666666">Press enter or escape to go back</text>
        </box>
      )}

      {phase === "error" && (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#FF4444">
            <b>Error</b>
          </text>
          <text fg="#FF4444">{error}</text>
          <text> </text>
          <text fg="#666666">Press escape to go back</text>
        </box>
      )}
    </box>
  );
}
