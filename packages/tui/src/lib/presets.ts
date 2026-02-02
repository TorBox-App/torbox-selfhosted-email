import type {
  ConfigPreset,
  FeatureConfig,
  SESEventType,
  WrapsEmailConfig,
} from "../types";
import { calculateCosts, formatCost } from "./costs";

export const STARTER_PRESET: WrapsEmailConfig = {
  tracking: { enabled: true, opens: true, clicks: true },
  tlsRequired: true,
  reputationMetrics: false,
  suppressionList: { enabled: true, reasons: ["BOUNCE", "COMPLAINT"] },
  eventTracking: { enabled: false },
  emailArchiving: { enabled: false, retention: "30days" },
  alerts: { enabled: false },
  sendingEnabled: true,
};

export const PRODUCTION_PRESET: WrapsEmailConfig = {
  tracking: { enabled: true, opens: true, clicks: true },
  tlsRequired: true,
  reputationMetrics: true,
  suppressionList: { enabled: true, reasons: ["BOUNCE", "COMPLAINT"] },
  eventTracking: {
    enabled: true,
    eventBridge: true,
    events: [
      "SEND",
      "DELIVERY",
      "OPEN",
      "CLICK",
      "BOUNCE",
      "COMPLAINT",
      "REJECT",
      "RENDERING_FAILURE",
    ],
    dynamoDBHistory: true,
    archiveRetention: "90days",
  },
  emailArchiving: { enabled: false, retention: "90days" },
  alerts: { enabled: true, dlqAlerts: true },
  sendingEnabled: true,
};

export const ENTERPRISE_PRESET: WrapsEmailConfig = {
  tracking: { enabled: true, opens: true, clicks: true },
  tlsRequired: true,
  reputationMetrics: true,
  suppressionList: { enabled: true, reasons: ["BOUNCE", "COMPLAINT"] },
  eventTracking: {
    enabled: true,
    eventBridge: true,
    events: [
      "SEND",
      "DELIVERY",
      "OPEN",
      "CLICK",
      "BOUNCE",
      "COMPLAINT",
      "REJECT",
      "RENDERING_FAILURE",
      "DELIVERY_DELAY",
      "SUBSCRIPTION",
    ],
    dynamoDBHistory: true,
    archiveRetention: "1year",
  },
  emailArchiving: { enabled: false, retention: "1year" },
  alerts: {
    enabled: true,
    dlqAlerts: true,
    thresholds: {
      bounceRateWarning: 0.01,
      bounceRateCritical: 0.02,
      complaintRateWarning: 0.0003,
      complaintRateCritical: 0.0005,
    },
  },
  dedicatedIp: true,
  sendingEnabled: true,
};

export function getPreset(preset: ConfigPreset): WrapsEmailConfig | null {
  switch (preset) {
    case "starter":
      return STARTER_PRESET;
    case "production":
      return PRODUCTION_PRESET;
    case "enterprise":
      return ENTERPRISE_PRESET;
    case "custom":
      return null;
  }
}

export type PresetInfo = {
  name: string;
  description: string;
  recommended: string;
  volume: string;
  estimatedCost: string;
  features: string[];
};

export function getPresetInfo(preset: ConfigPreset): PresetInfo {
  const config = getPreset(preset);

  if (preset === "custom" || !config) {
    return {
      name: "Custom",
      description: "Configure each feature individually",
      recommended: "Advanced users who need specific configuration",
      volume: "Any volume",
      estimatedCost: "Varies",
      features: ["Full control over all features"],
    };
  }

  const costs = calculateCosts(
    config,
    preset === "starter"
      ? 10_000
      : preset === "production"
        ? 100_000
        : 1_000_000
  );

  const baseInfo = {
    starter: {
      name: "Starter",
      description: "Minimal features for low-volume senders",
      recommended: "Side projects, MVPs, development/staging",
      volume: "Up to 10k emails/month",
      features: [
        "Open & click tracking",
        "TLS encryption required",
        "Automatic bounce/complaint suppression",
      ],
    },
    production: {
      name: "Production",
      description: "Recommended for most production applications",
      recommended: "SaaS apps, B2B products, moderate volume",
      volume: "10k-500k emails/month",
      features: [
        "Everything in Starter",
        "Reputation tracking",
        "Real-time event tracking (EventBridge)",
        "90-day email history storage",
        "Reputation alerts (bounce/complaint monitoring)",
      ],
    },
    enterprise: {
      name: "Enterprise",
      description: "Full features for high-volume senders",
      recommended: "Large platforms, high-volume transactional email",
      volume: "500k+ emails/month",
      features: [
        "Everything in Production",
        "Dedicated IP address",
        "1-year email history",
        "Stricter alert thresholds",
        "All 10 event types tracked",
      ],
    },
  }[preset];

  return {
    ...baseInfo,
    estimatedCost: formatCost(costs.total.monthly),
  } as PresetInfo;
}

// --- Feature ↔ Config conversions ---

export function presetToFeatures(preset: ConfigPreset): FeatureConfig {
  switch (preset) {
    case "starter":
      return {
        tracking: true,
        reputationMetrics: false,
        eventTracking: false,
        emailHistory: false,
        historyRetention: "30days",
        emailArchiving: false,
        archiveRetention: "30days",
        alerts: false,
        dedicatedIp: false,
      };
    case "enterprise":
      return {
        tracking: true,
        reputationMetrics: true,
        eventTracking: true,
        emailHistory: true,
        historyRetention: "1year",
        emailArchiving: false,
        archiveRetention: "1year",
        alerts: true,
        dedicatedIp: true,
      };
    default:
      return {
        tracking: true,
        reputationMetrics: true,
        eventTracking: true,
        emailHistory: true,
        historyRetention: "90days",
        emailArchiving: false,
        archiveRetention: "90days",
        alerts: true,
        dedicatedIp: false,
      };
  }
}

export function featuresToEmailConfig(
  features: FeatureConfig
): WrapsEmailConfig {
  const events: SESEventType[] = features.dedicatedIp
    ? [
        "SEND",
        "DELIVERY",
        "OPEN",
        "CLICK",
        "BOUNCE",
        "COMPLAINT",
        "REJECT",
        "RENDERING_FAILURE",
        "DELIVERY_DELAY",
        "SUBSCRIPTION",
      ]
    : [
        "SEND",
        "DELIVERY",
        "OPEN",
        "CLICK",
        "BOUNCE",
        "COMPLAINT",
        "REJECT",
        "RENDERING_FAILURE",
      ];

  return {
    tracking: { enabled: features.tracking, opens: true, clicks: true },
    tlsRequired: true,
    reputationMetrics: features.reputationMetrics,
    suppressionList: { enabled: true, reasons: ["BOUNCE", "COMPLAINT"] },
    eventTracking: {
      enabled: features.eventTracking,
      eventBridge: features.eventTracking,
      events: features.eventTracking ? events : undefined,
      dynamoDBHistory: features.emailHistory,
      archiveRetention: features.historyRetention,
    },
    emailArchiving: {
      enabled: features.emailArchiving,
      retention: features.archiveRetention,
    },
    alerts: { enabled: features.alerts, dlqAlerts: features.alerts },
    dedicatedIp: features.dedicatedIp,
    sendingEnabled: true,
  };
}

export function derivePreset(features: FeatureConfig): ConfigPreset {
  if (features.dedicatedIp) {
    return "enterprise";
  }
  if (features.eventTracking || features.emailHistory || features.alerts) {
    return "production";
  }
  return "starter";
}
