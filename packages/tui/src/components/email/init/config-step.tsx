import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef, useState } from "react";
import { useFocus } from "../../../contexts/focus";
import { useShortcuts } from "../../../contexts/shortcuts";
import { isEnter, isTab } from "../../../lib/keys";
import { AWS_REGIONS } from "../../../lib/regions";
import type { InitConfig, Provider } from "../../../types";
import { StepIndicator } from "../../shared/step-indicator";

interface ConfigStepProps {
  config: Partial<InitConfig>;
  onNext: (config: Partial<InitConfig>) => void;
  onBack: () => void;
  stepIndex: number;
}

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "vercel", label: "Vercel" },
  { value: "aws", label: "AWS" },
  { value: "railway", label: "Railway" },
  { value: "other", label: "Other" },
];

type Field = "provider" | "region" | "domain" | "vercelTeam" | "vercelProject";

export function ConfigStep({
  config,
  onNext,
  onBack,
  stepIndex,
}: ConfigStepProps) {
  const { width } = useTerminalDimensions();
  const { setInputActive } = useFocus();
  const { setShortcuts, clearShortcuts } = useShortcuts();

  const [provider, setProvider] = useState<Provider>(
    config.provider ?? "vercel"
  );
  const [providerIndex, setProviderIndex] = useState(
    Math.max(
      0,
      PROVIDERS.findIndex((p) => p.value === (config.provider ?? "vercel"))
    )
  );
  const [regionIndex, setRegionIndex] = useState(
    Math.max(
      0,
      AWS_REGIONS.findIndex((r) => r.value === (config.region ?? "us-east-1"))
    )
  );
  const [domain, setDomain] = useState(config.domain ?? "");
  const [vercelTeam, setVercelTeam] = useState(
    config.vercelConfig?.teamSlug ?? ""
  );
  const [vercelProject, setVercelProject] = useState(
    config.vercelConfig?.projectName ?? ""
  );
  const [focusField, setFocusField] = useState<Field>("provider");
  const [validationError, setValidationError] = useState<string | null>(null);

  const fields: Field[] =
    provider === "vercel"
      ? ["provider", "region", "domain", "vercelTeam", "vercelProject"]
      : ["provider", "region", "domain"];

  const focusIndex = fields.indexOf(focusField);
  const isTextInput =
    focusField === "domain" ||
    focusField === "vercelTeam" ||
    focusField === "vercelProject";

  // Track whether Esc was just used to blur (to require two presses)
  const justBlurred = useRef(false);

  useEffect(() => {
    setInputActive(isTextInput);
    justBlurred.current = false;
    return () => setInputActive(false);
  }, [isTextInput, setInputActive]);

  useEffect(() => {
    setShortcuts([
      { key: "tab", label: "Next field" },
      { key: "S-tab", label: "Prev field" },
      { key: "j/k", label: "Select" },
      { key: "enter", label: "Continue" },
      { key: "esc", label: "Back" },
    ]);
    return clearShortcuts;
  }, [setShortcuts, clearShortcuts]);

  useKeyboard((key) => {
    if (key.name === "escape") {
      if (isTextInput && !justBlurred.current) {
        // First Esc: blur the text input
        setInputActive(false);
        justBlurred.current = true;
        return;
      }
      // Second Esc (or non-text field): go back
      onBack();
      return;
    }

    // Any non-Esc key resets the blur tracker
    justBlurred.current = false;

    // Tab / Shift+Tab to move between fields
    const tab = isTab(key);
    if (tab) {
      setValidationError(null);
      if (tab.forward) {
        const nextIndex = Math.min(focusIndex + 1, fields.length - 1);
        setFocusField(fields[nextIndex]!);
      } else {
        const prevIndex = Math.max(focusIndex - 1, 0);
        setFocusField(fields[prevIndex]!);
      }
      return;
    }

    // Enter to submit or move to next field
    if (isEnter(key.name)) {
      if (isTextInput) {
        // Move to next field
        const nextIndex = focusIndex + 1;
        if (nextIndex < fields.length) {
          setFocusField(fields[nextIndex]!);
        } else {
          submitOrShowError();
        }
        return;
      }
      submitOrShowError();
      return;
    }

    // Select field navigation
    if (!isTextInput) {
      if (focusField === "provider") {
        if (key.name === "j" || key.name === "down") {
          const next = Math.min(PROVIDERS.length - 1, providerIndex + 1);
          setProviderIndex(next);
          setProvider(PROVIDERS[next]!.value);
        }
        if (key.name === "k" || key.name === "up") {
          const next = Math.max(0, providerIndex - 1);
          setProviderIndex(next);
          setProvider(PROVIDERS[next]!.value);
        }
      }

      if (focusField === "region") {
        if (key.name === "j" || key.name === "down") {
          setRegionIndex((i) => Math.min(AWS_REGIONS.length - 1, i + 1));
        }
        if (key.name === "k" || key.name === "up") {
          setRegionIndex((i) => Math.max(0, i - 1));
        }
      }
    }
  });

  function submitOrShowError() {
    const trimmedDomain = domain.trim();
    if (!trimmedDomain) {
      setValidationError("Domain is required");
      setFocusField("domain");
      return;
    }

    if (provider === "vercel") {
      const team = vercelTeam.trim();
      const project = vercelProject.trim();
      if (!team) {
        setValidationError("Vercel team slug is required");
        setFocusField("vercelTeam");
        return;
      }
      if (!project) {
        setValidationError("Vercel project name is required");
        setFocusField("vercelProject");
        return;
      }
      onNext({
        provider,
        region: AWS_REGIONS[regionIndex]!.value,
        domain: trimmedDomain,
        vercelConfig: { teamSlug: team, projectName: project },
      });
      return;
    }

    onNext({
      provider,
      region: AWS_REGIONS[regionIndex]!.value,
      domain: trimmedDomain,
    });
  }

  const leftWidth = Math.min(45, Math.floor(width * 0.5));
  const rightWidth = Math.max(20, width - leftWidth - 6);

  const helpText = getHelpText(focusField);

  // Check if form is complete for CTA display
  const isComplete =
    domain.trim() !== "" &&
    (provider !== "vercel" ||
      (vercelTeam.trim() !== "" && vercelProject.trim() !== ""));

  return (
    <box flexDirection="column" padding={1} width="100%">
      <text fg="#00AAFF">
        <b>Configuration</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>
      <text> </text>

      <StepIndicator currentIndex={stepIndex} />
      <text> </text>

      <box flexDirection="row" gap={3}>
        {/* Left: form fields */}
        <box flexDirection="column" width={leftWidth}>
          {/* Provider */}
          <box flexDirection="row" gap={1}>
            <text fg={focusField === "provider" ? "#00AAFF" : "#888888"}>
              {focusField === "provider" ? ">" : " "} Provider
            </text>
            <text fg="#FFFFFF">{`[${PROVIDERS[providerIndex]!.label}]`}</text>
          </box>

          {/* Region */}
          <box flexDirection="row" gap={1}>
            <text fg={focusField === "region" ? "#00AAFF" : "#888888"}>
              {focusField === "region" ? ">" : " "} Region{"  "}
            </text>
            <text fg="#FFFFFF">{`[${AWS_REGIONS[regionIndex]!.label}]`}</text>
          </box>

          {/* Domain */}
          <box flexDirection="row" gap={1}>
            <text
              fg={
                focusField === "domain"
                  ? "#00AAFF"
                  : validationError && !domain.trim()
                    ? "#FF4444"
                    : "#888888"
              }
            >
              {focusField === "domain" ? ">" : " "} Domain{"  "}
            </text>
            {focusField === "domain" ? (
              <input
                backgroundColor="#1a1a1a"
                cursorColor="#00AAFF"
                focused={true}
                focusedBackgroundColor="#222222"
                onChange={(v) => {
                  setDomain(v);
                  setValidationError(null);
                }}
                placeholder="myapp.com"
                placeholderColor="#555555"
                textColor="#FFFFFF"
                value={domain}
                width={30}
              />
            ) : (
              <text fg={domain ? "#FFFFFF" : "#555555"}>
                {domain || "myapp.com"}
              </text>
            )}
          </box>

          {/* Vercel fields */}
          {provider === "vercel" && (
            <>
              <text> </text>
              <text fg="#444444">── Vercel Configuration ──</text>

              <box flexDirection="row" gap={1}>
                <text
                  fg={focusField === "vercelTeam" ? "#00AAFF" : "#888888"}
                >
                  {focusField === "vercelTeam" ? ">" : " "} Team Slug
                </text>
                {focusField === "vercelTeam" ? (
                  <input
                    backgroundColor="#1a1a1a"
                    cursorColor="#00AAFF"
                    focused={true}
                    focusedBackgroundColor="#222222"
                    onChange={(v) => {
                      setVercelTeam(v);
                      setValidationError(null);
                    }}
                    placeholder="my-team"
                    placeholderColor="#555555"
                    textColor="#FFFFFF"
                    value={vercelTeam}
                    width={25}
                  />
                ) : (
                  <text fg={vercelTeam ? "#FFFFFF" : "#555555"}>
                    {vercelTeam || "my-team"}
                  </text>
                )}
              </box>

              <box flexDirection="row" gap={1}>
                <text
                  fg={focusField === "vercelProject" ? "#00AAFF" : "#888888"}
                >
                  {focusField === "vercelProject" ? ">" : " "} Project{"  "}
                </text>
                {focusField === "vercelProject" ? (
                  <input
                    backgroundColor="#1a1a1a"
                    cursorColor="#00AAFF"
                    focused={true}
                    focusedBackgroundColor="#222222"
                    onChange={(v) => {
                      setVercelProject(v);
                      setValidationError(null);
                    }}
                    placeholder="my-project"
                    placeholderColor="#555555"
                    textColor="#FFFFFF"
                    value={vercelProject}
                    width={25}
                  />
                ) : (
                  <text fg={vercelProject ? "#FFFFFF" : "#555555"}>
                    {vercelProject || "my-project"}
                  </text>
                )}
              </box>
            </>
          )}

          <text> </text>

          {/* Validation error */}
          {validationError && (
            <text fg="#FF4444">{validationError}</text>
          )}

          {/* CTA */}
          {isComplete ? (
            <text fg="#00AAFF">
              <b>{"[ Enter ] Continue to features >"}</b>
            </text>
          ) : (
            <text fg="#666666">
              Fill in all fields, then press Enter to continue
            </text>
          )}
        </box>

        {/* Right: help panel */}
        <box flexDirection="column" width={rightWidth}>
          <text fg="#444444">{"┌" + "─".repeat(rightWidth - 2) + "┐"}</text>
          <text fg="#00AAFF">
            <b>
              {"│ "}
              {helpText.title.padEnd(rightWidth - 4)}
              {"│"}
            </b>
          </text>
          <text fg="#444444">{"│" + " ".repeat(rightWidth - 2) + "│"}</text>
          {helpText.lines.map((line, i) => (
            <text fg="#AAAAAA" key={i}>
              {"│ "}
              {line.padEnd(rightWidth - 4)}
              {"│"}
            </text>
          ))}
          <text fg="#444444">{"└" + "─".repeat(rightWidth - 2) + "┘"}</text>
        </box>
      </box>
    </box>
  );
}

function getHelpText(field: Field): { title: string; lines: string[] } {
  switch (field) {
    case "provider":
      return {
        title: "Provider",
        lines: [
          "Your hosting provider determines",
          "how AWS credentials are provided.",
          "",
          "Vercel: Uses OIDC for secure,",
          "credential-free access.",
          "AWS: Direct IAM role assumption.",
          "Other: Environment variables.",
        ],
      };
    case "region":
      return {
        title: "AWS Region",
        lines: [
          "Choose the region closest to",
          "your users for lower latency.",
          "",
          "us-east-1 is recommended for",
          "most use cases (best SES support).",
        ],
      };
    case "domain":
      return {
        title: "Domain",
        lines: [
          "The domain you'll send emails",
          "from (e.g., myapp.com).",
          "",
          "You'll need to add DNS records",
          "for DKIM verification after setup.",
        ],
      };
    case "vercelTeam":
      return {
        title: "Vercel Team Slug",
        lines: [
          "Your Vercel team slug from the",
          "dashboard URL.",
          "",
          "Found at: vercel.com/<team-slug>",
        ],
      };
    case "vercelProject":
      return {
        title: "Vercel Project",
        lines: [
          "The Vercel project that will",
          "send emails via Wraps.",
          "",
          "OIDC credentials will be scoped",
          "to this project only.",
        ],
      };
  }
}
