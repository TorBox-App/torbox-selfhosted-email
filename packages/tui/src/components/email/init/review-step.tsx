import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect } from "react";
import { useShortcuts } from "../../../contexts/shortcuts";
import { calculateCosts, formatCost } from "../../../lib/costs";
import { isEnter } from "../../../lib/keys";
import { featuresToEmailConfig } from "../../../lib/presets";
import { getRegionLabel } from "../../../lib/regions";
import { getPlannedResources } from "../../../lib/resources";
import type { InitConfig } from "../../../types";
import { StepIndicator } from "../../shared/step-indicator";

interface ReviewStepProps {
  config: InitConfig;
  accountId: string;
  onConfirm: () => void;
  onBack: () => void;
  stepIndex: number;
}

export function ReviewStep({
  config,
  accountId,
  onConfirm,
  onBack,
  stepIndex,
}: ReviewStepProps) {
  const { width } = useTerminalDimensions();
  const { setShortcuts, clearShortcuts } = useShortcuts();

  useEffect(() => {
    setShortcuts([
      { key: "enter", label: "Deploy" },
      { key: "esc", label: "Go back" },
    ]);
    return clearShortcuts;
  }, [setShortcuts, clearShortcuts]);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
    }
    if (isEnter(key.name)) {
      onConfirm();
    }
  });

  const emailConfig = featuresToEmailConfig(config.features);
  const costs = calculateCosts(emailConfig, config.estimatedVolume);
  const resources = getPlannedResources(config.provider, config.features);
  const per1kCost =
    config.estimatedVolume > 0
      ? (costs.total.monthly / config.estimatedVolume) * 1000
      : 0;

  const colWidth = Math.min(35, Math.floor((width - 8) / 2));

  return (
    <box flexDirection="column" padding={1} width="100%">
      <text fg="#00AAFF">
        <b>Review & Deploy</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>
      <text> </text>

      <StepIndicator currentIndex={stepIndex} />
      <text> </text>

      <box flexDirection="row" gap={3}>
        {/* Left: config summary */}
        <box flexDirection="column" width={colWidth}>
          <text fg="#444444">
            {"┌─ Configuration " +
              "─".repeat(Math.max(0, colWidth - 18)) +
              "┐"}
          </text>
          <ConfigLine
            label="Provider"
            value={capitalize(config.provider)}
            width={colWidth}
          />
          <ConfigLine
            label="Region"
            value={getRegionLabel(config.region)}
            width={colWidth}
          />
          <ConfigLine label="Domain" value={config.domain} width={colWidth} />

          {config.vercelConfig && (
            <>
              <ConfigLine
                label="Team"
                value={config.vercelConfig.teamSlug}
                width={colWidth}
              />
              <ConfigLine
                label="Project"
                value={config.vercelConfig.projectName}
                width={colWidth}
              />
            </>
          )}

          <text fg="#444444">{"│" + " ".repeat(colWidth - 2) + "│"}</text>
          <ConfigLine
            label="Preset"
            value={capitalize(config.preset)}
            width={colWidth}
          />
          <ConfigLine
            label="Volume"
            value={`~${formatVolume(config.estimatedVolume)}/month`}
            width={colWidth}
          />

          {/* Feature summary */}
          <text fg="#444444">{"│" + " ".repeat(colWidth - 2) + "│"}</text>
          <text fg="#AAAAAA">
            {"│ ── Features ──".padEnd(colWidth - 1)}
            {"│"}
          </text>
          {config.features.tracking && (
            <FeatureLine label="Tracking" width={colWidth} />
          )}
          {config.features.reputationMetrics && (
            <FeatureLine label="Reputation metrics" width={colWidth} />
          )}
          {config.features.eventTracking && (
            <FeatureLine label="Event tracking" width={colWidth} />
          )}
          {config.features.emailHistory && (
            <FeatureLine
              label={`Email history (${config.features.historyRetention})`}
              width={colWidth}
            />
          )}
          {config.features.emailArchiving && (
            <FeatureLine
              label={`Archiving (${config.features.archiveRetention})`}
              width={colWidth}
            />
          )}
          {config.features.alerts && (
            <FeatureLine label="Alerts" width={colWidth} />
          )}
          {config.features.dedicatedIp && (
            <FeatureLine label="Dedicated IP" width={colWidth} />
          )}

          {/* Cost summary */}
          <text fg="#444444">{"│" + " ".repeat(colWidth - 2) + "│"}</text>
          <text fg="#AAAAAA">
            {"│ ── Cost Estimate ──".padEnd(colWidth - 1)}
            {"│"}
          </text>

          {/* Per-feature costs */}
          <CostRow
            label="SES"
            value={formatCost(config.estimatedVolume * 0.0001)}
            width={colWidth}
          />
          {costs.eventTracking && (
            <CostRow
              label="Events"
              value={formatCost(costs.eventTracking.monthly)}
              width={colWidth}
            />
          )}
          {costs.dynamoDBHistory && (
            <CostRow
              label="History"
              value={formatCost(costs.dynamoDBHistory.monthly)}
              width={colWidth}
            />
          )}
          {costs.emailArchiving && (
            <CostRow
              label="Archive"
              value={formatCost(costs.emailArchiving.monthly)}
              width={colWidth}
            />
          )}
          {costs.alerts && (
            <CostRow
              label="Alerts"
              value={formatCost(costs.alerts.monthly)}
              width={colWidth}
            />
          )}
          {costs.dedicatedIp && (
            <CostRow
              label="Ded. IP"
              value={formatCost(costs.dedicatedIp.monthly)}
              width={colWidth}
            />
          )}

          <text fg="#444444">{"│" + " ".repeat(colWidth - 2) + "│"}</text>
          <text fg="#00AAFF">
            <b>
              {"│ "}
              {`Total: ~${formatCost(costs.total.monthly)}/month`.padEnd(
                colWidth - 4
              )}
              {"│"}
            </b>
          </text>
          <text fg="#FFFF00">
            {"│ "}
            {`Per 1k emails: ${formatCost(per1kCost)}`.padEnd(colWidth - 4)}
            {"│"}
          </text>

          <text fg="#444444">{"└" + "─".repeat(colWidth - 2) + "┘"}</text>
        </box>

        {/* Right: planned resources */}
        <box flexDirection="column" width={colWidth}>
          <text fg="#444444">
            {"┌─ Infrastructure " +
              "─".repeat(Math.max(0, colWidth - 19)) +
              "┐"}
          </text>
          <text fg="#AAAAAA">
            {"│ Resources to create:".padEnd(colWidth - 1)}
            {"│"}
          </text>
          <text fg="#444444">{"│" + " ".repeat(colWidth - 2) + "│"}</text>
          {resources.map((resource, i) => (
            <text fg="#FFFFFF" key={i}>
              {"│ ✦ "}
              {resource.padEnd(colWidth - 6)}
              {"│"}
            </text>
          ))}
          <text fg="#444444">{"└" + "─".repeat(colWidth - 2) + "┘"}</text>
        </box>
      </box>

      <text> </text>
      <text fg="#AAAAAA">Deploy to AWS account {accountId}?</text>
      <text> </text>
      <text fg="#00AAFF">
        <b>{"[ Enter ] Deploy infrastructure >"}</b>
      </text>
      <text fg="#666666">ESC to go back and edit</text>
    </box>
  );
}

function ConfigLine({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: number;
}) {
  const inner = ` ${label.padEnd(12)} ${value}`;
  return (
    <text fg="#FFFFFF">
      {"│"}
      {inner.padEnd(width - 2).slice(0, width - 2)}
      {"│"}
    </text>
  );
}

function FeatureLine({ label, width }: { label: string; width: number }) {
  return (
    <text fg="#00FF00">
      {"│ ✓ "}
      {label.padEnd(width - 6).slice(0, width - 6)}
      {"│"}
    </text>
  );
}

function CostRow({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: number;
}) {
  const gap = Math.max(1, width - 4 - label.length - value.length);
  const inner = `${label}${" ".repeat(gap)}${value}`;
  return (
    <text fg="#FFFFFF">
      {"│ "}
      {inner.padEnd(width - 4).slice(0, width - 4)}
      {"│"}
    </text>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(0)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(0)}k`;
  return `${volume}`;
}
