import { useKeyboard } from "@opentui/react";
import { useCallback, useState } from "react";
import { useFocus } from "../../contexts/focus";
import { removeDomain } from "../../lib/aws";

interface DomainsRemoveProps {
  domain: string;
  region: string;
  onBack: () => void;
  onComplete: () => void;
}

type Phase = "confirm" | "removing" | "success" | "error";

export function DomainsRemove({
  domain,
  region,
  onBack,
  onComplete,
}: DomainsRemoveProps) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState<string | null>(null);
  const { inputActive } = useFocus();

  const handleRemove = useCallback(async () => {
    setPhase("removing");
    try {
      await removeDomain(region, domain);
      setPhase("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove domain");
      setPhase("error");
    }
  }, [domain, region]);

  useKeyboard((key) => {
    if (inputActive) return;

    if (phase === "confirm") {
      if (key.name === "y") {
        handleRemove();
      }
      if (key.name === "n" || key.name === "escape") {
        onBack();
      }
    }
    if (
      phase === "success" &&
      (key.name === "enter" || key.name === "escape")
    ) {
      onComplete();
    }
    if (phase === "error" && key.name === "escape") {
      onBack();
    }
  });

  return (
    <box flexDirection="column" padding={1} width="100%">
      <text fg="#FF4444">
        <b>Remove Domain</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>

      {phase === "confirm" && (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#FFFFFF">
            Are you sure you want to remove <b>{domain}</b> from SES?
          </text>
          <text> </text>
          <text fg="#FF4444">
            This will delete the email identity and all DKIM configuration.
          </text>
          <text fg="#FF4444">
            You will need to re-add and re-verify DNS records to use this domain
            again.
          </text>
          <text> </text>
          <text fg="#888888">
            Press <b>y</b> to confirm, <b>n</b> or escape to cancel
          </text>
        </box>
      )}

      {phase === "removing" && (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#FFFF00">Removing {domain}...</text>
        </box>
      )}

      {phase === "success" && (
        <box flexDirection="column" paddingTop={1}>
          <text fg="#00FF00">
            <b>{domain}</b> has been removed from SES.
          </text>
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
