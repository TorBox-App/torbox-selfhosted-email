import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";
import { useShortcuts } from "../../../contexts/shortcuts";
import { isEnter } from "../../../lib/keys";
import type { AccountData } from "../../../types";
import { StepIndicator } from "../../shared/step-indicator";

interface WelcomeStepProps {
  data: AccountData;
  onNext: () => void;
  onBack: () => void;
  stepIndex: number;
}

export function WelcomeStep({
  data,
  onNext,
  onBack,
  stepIndex,
}: WelcomeStepProps) {
  const existingEmail = data.metadata?.services?.email;
  const { setShortcuts, clearShortcuts } = useShortcuts();

  useEffect(() => {
    setShortcuts([
      { key: "enter", label: "Continue" },
      { key: "esc", label: "Exit" },
    ]);
    return clearShortcuts;
  }, [setShortcuts, clearShortcuts]);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
    }
    if (isEnter(key.name)) {
      onNext();
    }
  });

  return (
    <box flexDirection="column" padding={1} width="100%">
      <text fg="#00AAFF">
        <b>Deploy Email Infrastructure</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>
      <text> </text>

      <StepIndicator currentIndex={stepIndex} />
      <text> </text>

      <box flexDirection="column">
        <text fg="#00FF00">
          <b>{"✓"}</b> Connected to AWS account {data.accountId}
        </text>
        <text fg="#00FF00">
          <b>{"✓"}</b> Region: {data.region}
        </text>
        <text> </text>

        {existingEmail ? (
          <>
            <text fg="#FFFF00">
              Email infrastructure already exists for this account/region.
            </text>
            <text fg="#FFFF00">
              Preset:{" "}
              {existingEmail.preset
                ? capitalize(existingEmail.preset)
                : "Custom"}
            </text>
            <text> </text>
            <text fg="#AAAAAA">
              This will set up a new deployment alongside the existing one.
            </text>
            <text fg="#888888">
              Consider using `wraps email upgrade` to modify existing
              infrastructure.
            </text>
          </>
        ) : (
          <>
            <text fg="#AAAAAA">
              This will deploy email infrastructure to your AWS account.
            </text>
            <text fg="#AAAAAA">
              You own everything — infrastructure stays in your account.
            </text>
          </>
        )}

        <text> </text>
        <text fg="#00AAFF">
          <b>{"[ Enter ] Continue to configuration >"}</b>
        </text>
        <text fg="#666666">ESC to go back</text>
      </box>
    </box>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
