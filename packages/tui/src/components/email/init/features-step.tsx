import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useState } from "react";
import { useShortcuts } from "../../../contexts/shortcuts";
import { calculateCosts, formatCost } from "../../../lib/costs";
import { isEnter, isTab } from "../../../lib/keys";
import {
  derivePreset,
  featuresToEmailConfig,
  presetToFeatures,
} from "../../../lib/presets";
import { getPlannedResources } from "../../../lib/resources";
import type {
  ArchiveRetention,
  ConfigPreset,
  FeatureConfig,
  InitConfig,
  Provider,
} from "../../../types";
import { StepIndicator } from "../../shared/step-indicator";

interface FeaturesStepProps {
  config: Partial<InitConfig>;
  onNext: (config: Partial<InitConfig>) => void;
  onBack: () => void;
  stepIndex: number;
}

const TEMPLATES: { value: ConfigPreset; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "production", label: "Production" },
  { value: "enterprise", label: "Enterprise" },
];

const VOLUMES = [
  { value: 1_000, label: "< 1k/mo" },
  { value: 10_000, label: "10k/mo" },
  { value: 50_000, label: "50k/mo" },
  { value: 100_000, label: "100k/mo" },
  { value: 500_000, label: "500k/mo" },
  { value: 1_000_000, label: "1M+/mo" },
];

const RETENTION_OPTIONS: { value: ArchiveRetention; label: string }[] = [
  { value: "7days", label: "7 days" },
  { value: "30days", label: "30 days" },
  { value: "90days", label: "90 days" },
  { value: "6months", label: "6 months" },
  { value: "1year", label: "1 year" },
  { value: "2years", label: "2 years" },
  { value: "5years", label: "5 years" },
];

type FeatureKey =
  | "tracking"
  | "reputationMetrics"
  | "eventTracking"
  | "emailHistory"
  | "emailArchiving"
  | "alerts"
  | "dedicatedIp";

const FEATURE_DEFS: { key: FeatureKey; label: string }[] = [
  { key: "tracking", label: "Open & click tracking" },
  { key: "reputationMetrics", label: "Reputation metrics" },
  { key: "eventTracking", label: "Event tracking (EventBridge)" },
  { key: "emailHistory", label: "Email history (DynamoDB)" },
  { key: "emailArchiving", label: "Email archiving (full content)" },
  { key: "alerts", label: "Bounce/complaint alerts" },
  { key: "dedicatedIp", label: "Dedicated IP address" },
];

type Row =
  | { type: "template" }
  | { type: "volume" }
  | { type: "feature"; key: FeatureKey; label: string }
  | { type: "retention"; configKey: "historyRetention" | "archiveRetention" };

export function FeaturesStep({
  config,
  onNext,
  onBack,
  stepIndex,
}: FeaturesStepProps) {
  const { width } = useTerminalDimensions();
  const { setShortcuts, clearShortcuts } = useShortcuts();

  const [templateIndex, setTemplateIndex] = useState(() => {
    const preset = config.preset ?? "production";
    const idx = TEMPLATES.findIndex((t) => t.value === preset);
    return Math.max(0, idx);
  });

  const [volumeIndex, setVolumeIndex] = useState(() => {
    if (config.estimatedVolume) {
      const idx = VOLUMES.findIndex((v) => v.value === config.estimatedVolume);
      return Math.max(0, idx);
    }
    return 1;
  });

  const [features, setFeatures] = useState<FeatureConfig>(
    () => config.features ?? presetToFeatures(config.preset ?? "production")
  );

  const [focusIndex, setFocusIndex] = useState(0);

  // Build navigable rows dynamically
  const rows = useMemo((): Row[] => {
    const result: Row[] = [{ type: "template" }, { type: "volume" }];
    for (const def of FEATURE_DEFS) {
      result.push({ type: "feature", key: def.key, label: def.label });
      if (def.key === "emailHistory" && features.emailHistory) {
        result.push({ type: "retention", configKey: "historyRetention" });
      }
      if (def.key === "emailArchiving" && features.emailArchiving) {
        result.push({ type: "retention", configKey: "archiveRetention" });
      }
    }
    return result;
  }, [features.emailHistory, features.emailArchiving]);

  const clampedFocus = Math.min(focusIndex, rows.length - 1);
  const currentRow = rows[clampedFocus]!;

  // Cost calculations
  const currentVolume = VOLUMES[volumeIndex]!.value;
  const emailConfig = featuresToEmailConfig(features);
  const costs = calculateCosts(emailConfig, currentVolume);
  const provider = (config.provider ?? "aws") as Provider;
  const resources = getPlannedResources(provider, features);
  const derivedPreset = derivePreset(features);
  const per1kCost =
    currentVolume > 0 ? (costs.total.monthly / currentVolume) * 1000 : 0;

  useEffect(() => {
    setShortcuts([
      { key: "tab", label: "Next row" },
      { key: "S-tab", label: "Prev row" },
      { key: "space", label: "Toggle" },
      { key: "h/l", label: "Adjust" },
      { key: "enter", label: "Continue" },
      { key: "esc", label: "Back" },
    ]);
    return clearShortcuts;
  }, [setShortcuts, clearShortcuts]);

  function toggleFeature(key: FeatureKey) {
    setFeatures((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Dependency: emailHistory requires eventTracking
      if (key === "eventTracking" && !next.eventTracking) {
        next.emailHistory = false;
      }
      return next;
    });
  }

  function applyTemplate(index: number) {
    setTemplateIndex(index);
    setFeatures(presetToFeatures(TEMPLATES[index]!.value));
  }

  function cycleRetention(
    configKey: "historyRetention" | "archiveRetention",
    direction: 1 | -1
  ) {
    setFeatures((prev) => {
      const idx = RETENTION_OPTIONS.findIndex(
        (r) => r.value === prev[configKey]
      );
      const next = Math.max(
        0,
        Math.min(RETENTION_OPTIONS.length - 1, idx + direction)
      );
      return { ...prev, [configKey]: RETENTION_OPTIONS[next]!.value };
    });
  }

  useKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
      return;
    }

    if (isEnter(key.name)) {
      onNext({
        preset: derivedPreset,
        features,
        estimatedVolume: currentVolume,
      });
      return;
    }

    // Tab / Shift+Tab to navigate rows (alias for j/k)
    const tab = isTab(key);
    if (tab) {
      if (tab.forward) {
        setFocusIndex((i) => Math.min(rows.length - 1, i + 1));
      } else {
        setFocusIndex((i) => Math.max(0, i - 1));
      }
      return;
    }

    if (key.name === "j" || key.name === "down") {
      setFocusIndex((i) => Math.min(rows.length - 1, i + 1));
      return;
    }
    if (key.name === "k" || key.name === "up") {
      setFocusIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (currentRow.type === "template") {
      if (key.name === "left" || key.name === "h") {
        applyTemplate(Math.max(0, templateIndex - 1));
      }
      if (key.name === "right" || key.name === "l") {
        applyTemplate(Math.min(TEMPLATES.length - 1, templateIndex + 1));
      }
    }

    if (currentRow.type === "volume") {
      if (key.name === "left" || key.name === "h") {
        setVolumeIndex((i) => Math.max(0, i - 1));
      }
      if (key.name === "right" || key.name === "l") {
        setVolumeIndex((i) => Math.min(VOLUMES.length - 1, i + 1));
      }
    }

    if (currentRow.type === "feature" && key.name === "space") {
      const fKey = currentRow.key;
      // Can't enable emailHistory without eventTracking
      if (fKey === "emailHistory" && !features.eventTracking) return;
      toggleFeature(fKey);
    }

    if (currentRow.type === "retention") {
      if (key.name === "left" || key.name === "h") {
        cycleRetention(currentRow.configKey, -1);
      }
      if (key.name === "right" || key.name === "l") {
        cycleRetention(currentRow.configKey, 1);
      }
    }
  });

  const leftWidth = Math.min(48, Math.floor(width * 0.5));
  const rightWidth = Math.max(30, width - leftWidth - 6);

  function getFeatureCostLabel(key: FeatureKey): string {
    if (!features[key]) return "";
    const map: Record<string, { monthly: number } | undefined> = {
      tracking: costs.tracking,
      reputationMetrics: costs.reputationMetrics,
      eventTracking: costs.eventTracking,
      emailHistory: costs.dynamoDBHistory,
      emailArchiving: costs.emailArchiving,
      alerts: costs.alerts,
      dedicatedIp: costs.dedicatedIp,
    };
    const c = map[key];
    return c ? formatCost(c.monthly) : "Free";
  }

  const featureStartIdx = 2;

  return (
    <box flexDirection="column" padding={1} width="100%">
      <text fg="#00AAFF">
        <b>Configure Features</b>
      </text>
      <text fg="#444444">{"─".repeat(60)}</text>
      <text> </text>

      <StepIndicator currentIndex={stepIndex} />
      <text> </text>

      <box flexDirection="row" gap={3}>
        {/* Left: controls */}
        <box flexDirection="column" width={leftWidth}>
          {/* Template */}
          <box flexDirection="row" gap={1}>
            <text fg={clampedFocus === 0 ? "#00AAFF" : "#888888"}>
              {clampedFocus === 0 ? ">" : " "} Template
            </text>
            <text fg="#FFFFFF">
              {"◄ "}
              {TEMPLATES[templateIndex]!.label}
              {" ►"}
            </text>
          </box>

          {/* Volume */}
          <box flexDirection="row" gap={1}>
            <text fg={clampedFocus === 1 ? "#00AAFF" : "#888888"}>
              {clampedFocus === 1 ? ">" : " "} Volume{"  "}
            </text>
            <text fg="#FFFFFF">
              {"◄ "}
              {VOLUMES[volumeIndex]!.label}
              {" ►"}
            </text>
          </box>

          <text> </text>
          <text fg="#444444">── Features ──</text>

          {/* Feature rows */}
          {rows.slice(featureStartIdx).map((row, i) => {
            const globalIdx = featureStartIdx + i;
            const focused = globalIdx === clampedFocus;
            const indicator = focused ? ">" : " ";

            if (row.type === "feature") {
              const enabled = features[row.key];
              const isDisabled =
                row.key === "emailHistory" && !features.eventTracking;
              const check = enabled ? "✓" : " ";
              const costLabel = getFeatureCostLabel(row.key);

              const fg = isDisabled
                ? "#555555"
                : focused
                  ? "#00AAFF"
                  : enabled
                    ? "#FFFFFF"
                    : "#888888";

              return (
                <box flexDirection="column" key={row.key}>
                  <box flexDirection="row">
                    <text fg={fg}>
                      {indicator} [{check}] {row.label}
                    </text>
                    {costLabel ? <text fg="#666666"> {costLabel}</text> : null}
                  </box>
                  {/* Dependency hint: only show when focused */}
                  {focused && isDisabled && (
                    <text fg="#FFFF00">
                      {"       Requires Event Tracking"}
                    </text>
                  )}
                </box>
              );
            }

            if (row.type === "retention") {
              const val = features[row.configKey];
              const opt = RETENTION_OPTIONS.find((r) => r.value === val);
              return (
                <box flexDirection="row" key={row.configKey}>
                  <text fg={focused ? "#00AAFF" : "#888888"}>
                    {indicator}
                    {"     └─ Retention: "}
                  </text>
                  <text fg="#FFFFFF">
                    {"◄ "}
                    {opt?.label ?? val}
                    {" ►"}
                  </text>
                </box>
              );
            }

            return null;
          })}

          <text> </text>
          <text fg="#00AAFF">
            <b>{"[ Enter ] Continue to review >"}</b>
          </text>
        </box>

        {/* Right: cost + resources panel */}
        <box flexDirection="column" width={rightWidth}>
          <text fg="#444444">
            {"┌" + "─".repeat(rightWidth - 2) + "┐"}
          </text>
          <text fg="#00AAFF">
            <b>
              {"│ "}
              {`Cost Estimate (${formatVolume(currentVolume)}/mo)`.padEnd(
                rightWidth - 4
              )}
              {"│"}
            </b>
          </text>
          <text fg="#444444">
            {"│" + " ".repeat(rightWidth - 2) + "│"}
          </text>

          {/* SES base cost */}
          <CostLine
            cost={formatCost(currentVolume * 0.0001)}
            label="SES sending"
            width={rightWidth}
          />

          {costs.eventTracking && (
            <CostLine
              cost={formatCost(costs.eventTracking.monthly)}
              label="Event processing"
              width={rightWidth}
            />
          )}
          {costs.dynamoDBHistory && (
            <CostLine
              cost={formatCost(costs.dynamoDBHistory.monthly)}
              label="Email history"
              width={rightWidth}
            />
          )}
          {costs.emailArchiving && (
            <CostLine
              cost={formatCost(costs.emailArchiving.monthly)}
              label="Archiving"
              width={rightWidth}
            />
          )}
          {costs.alerts && (
            <CostLine
              cost={formatCost(costs.alerts.monthly)}
              label="Alerts"
              width={rightWidth}
            />
          )}
          {costs.dedicatedIp && (
            <CostLine
              cost={formatCost(costs.dedicatedIp.monthly)}
              label="Dedicated IP"
              width={rightWidth}
            />
          )}

          <text fg="#444444">
            {"│" + " ".repeat(rightWidth - 2) + "│"}
          </text>
          <text fg="#00AAFF">
            <b>
              {"│ "}
              {`Total: ${formatCost(costs.total.monthly)}/mo`.padEnd(
                rightWidth - 4
              )}
              {"│"}
            </b>
          </text>
          <text fg="#FFFF00">
            {"│ "}
            {`Per 1k emails: ${formatCost(per1kCost)}`.padEnd(rightWidth - 4)}
            {"│"}
          </text>

          <text fg="#444444">
            {"│" + " ".repeat(rightWidth - 2) + "│"}
          </text>
          <text fg="#AAAAAA">
            {"│ ── AWS Resources ──".padEnd(rightWidth - 1)}
            {"│"}
          </text>
          <text fg="#444444">
            {"│" + " ".repeat(rightWidth - 2) + "│"}
          </text>
          {resources.map((resource, i) => (
            <text fg="#FFFFFF" key={i}>
              {"│ ✦ "}
              {resource.padEnd(rightWidth - 6).slice(0, rightWidth - 6)}
              {"│"}
            </text>
          ))}

          <text fg="#444444">
            {"│" + " ".repeat(rightWidth - 2) + "│"}
          </text>
          <text fg="#888888">
            {"│ "}
            {`Deploys as: ${derivedPreset} preset`.padEnd(rightWidth - 4)}
            {"│"}
          </text>
          <text fg="#444444">
            {"└" + "─".repeat(rightWidth - 2) + "┘"}
          </text>
        </box>
      </box>
    </box>
  );
}

function CostLine({
  label,
  cost,
  width,
}: {
  label: string;
  cost: string;
  width: number;
}) {
  const gap = Math.max(1, width - 4 - label.length - cost.length);
  const inner = `${label}${" ".repeat(gap)}${cost}`;
  return (
    <text fg="#FFFFFF">
      {"│ "}
      {inner.padEnd(width - 4).slice(0, width - 4)}
      {"│"}
    </text>
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(0)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(0)}k`;
  return `${volume}`;
}
