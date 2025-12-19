import type { SMSConfigPreset, WrapsSMSConfig } from "../../types/index.js";
import { calculateSMSCosts, formatCost } from "./costs.js";

/**
 * Preset configurations with recommended settings for different use cases
 */

/**
 * Starter preset - minimal features for testing and low-volume
 * Perfect for: Development, testing, MVPs
 * Volume: Up to 100 messages/day (simulator limit)
 * Cost: ~$1/month (simulator number only)
 */
export const SMS_STARTER_PRESET: WrapsSMSConfig = {
  phoneNumberType: "simulator",
  tracking: {
    enabled: true,
    deliveryReports: true,
  },
  eventTracking: {
    enabled: false,
  },
  optOutManagement: true,
  sendingEnabled: true,
  protectConfiguration: {
    enabled: true,
    allowedCountries: ["US"],
    aitFiltering: false,
  },
};

/**
 * Production preset - recommended for most production applications
 * Perfect for: SaaS apps, OTP/verification, transactional SMS
 * Volume: Unlimited (3 MPS with toll-free)
 * Cost: ~$2-10/month (includes toll-free number + event tracking)
 */
export const SMS_PRODUCTION_PRESET: WrapsSMSConfig = {
  phoneNumberType: "toll-free",
  tracking: {
    enabled: true,
    deliveryReports: true,
  },
  eventTracking: {
    enabled: true,
    eventBridge: true,
    events: ["SENT", "DELIVERED", "FAILED", "OPTED_OUT"],
    dynamoDBHistory: true,
    archiveRetention: "90days",
  },
  optOutManagement: true,
  sendingEnabled: true,
  protectConfiguration: {
    enabled: true,
    allowedCountries: ["US"],
    aitFiltering: false, // No extra cost by default
  },
};

/**
 * Enterprise preset - full features for high-volume senders
 * Perfect for: Large platforms, high-volume transactional SMS
 * Volume: High (10DLC recommended for 75+ MPS)
 * Cost: ~$10-50/month (toll-free + full tracking + 1-year history)
 */
export const SMS_ENTERPRISE_PRESET: WrapsSMSConfig = {
  phoneNumberType: "toll-free",
  tracking: {
    enabled: true,
    deliveryReports: true,
    linkTracking: true,
  },
  eventTracking: {
    enabled: true,
    eventBridge: true,
    events: [
      "SENT",
      "DELIVERED",
      "FAILED",
      "QUEUED",
      "CARRIER_UNREACHABLE",
      "BLOCKED",
      "INVALID",
      "OPTED_OUT",
      "TTL_EXPIRED",
    ],
    dynamoDBHistory: true,
    archiveRetention: "1year",
  },
  messageArchiving: {
    enabled: true,
    retention: "1year",
  },
  optOutManagement: true,
  sendingEnabled: true,
  protectConfiguration: {
    enabled: true,
    allowedCountries: ["US"],
    aitFiltering: false, // No extra cost by default
  },
};

/**
 * Get preset configuration by name
 */
export function getSMSPreset(preset: SMSConfigPreset): WrapsSMSConfig | null {
  switch (preset) {
    case "starter":
      return SMS_STARTER_PRESET;
    case "production":
      return SMS_PRODUCTION_PRESET;
    case "enterprise":
      return SMS_ENTERPRISE_PRESET;
    case "custom":
      return null; // User will configure manually
  }
}

/**
 * Preset metadata for display
 */
export type SMSPresetInfo = {
  name: string;
  description: string;
  recommended: string;
  throughput: string;
  estimatedCost: string;
  features: string[];
};

/**
 * Get preset information for display
 */
export function getSMSPresetInfo(preset: SMSConfigPreset): SMSPresetInfo {
  const config = getSMSPreset(preset);

  if (preset === "custom" || !config) {
    return {
      name: "Custom",
      description: "Configure each feature individually",
      recommended: "Advanced users who need specific configuration",
      throughput: "Varies by number type",
      estimatedCost: "Varies",
      features: ["Full control over all features"],
    };
  }

  const messagesPerMonth =
    preset === "starter" ? 1000 : preset === "production" ? 10_000 : 100_000;

  const costs = calculateSMSCosts(config, messagesPerMonth);

  const baseInfo = {
    starter: {
      name: "Starter",
      description: "Simulator for testing (no real messages)",
      recommended: "Development, testing, MVPs",
      throughput: "100 messages/day (simulator limit)",
      features: [
        "Simulator phone number ($1/mo)",
        "Delivery status tracking",
        "Automatic opt-out management",
        "No registration required",
      ],
    },
    production: {
      name: "Production",
      description: "Toll-free number for production use",
      recommended: "SaaS apps, OTP, transactional SMS (RECOMMENDED)",
      throughput: "3 messages/second",
      features: [
        "Toll-free number ($2/mo)",
        "Real-time event tracking (EventBridge)",
        "90-day message history storage",
        "Automatic opt-out management",
        "Requires registration (~15 business days)",
      ],
    },
    enterprise: {
      name: "Enterprise",
      description: "Full features for high-volume senders",
      recommended: "Large platforms, high-volume transactional SMS",
      throughput: "3 MPS (toll-free) or 75+ MPS (10DLC)",
      features: [
        "Everything in Production",
        "Link click tracking",
        "Message content archiving",
        "1-year message history",
        "All event types tracked",
      ],
    },
  }[preset];

  return {
    ...baseInfo,
    estimatedCost: formatCost(costs.total.monthly),
  } as SMSPresetInfo;
}

/**
 * Get all preset options for CLI prompts
 */
export function getAllSMSPresetInfo(): SMSPresetInfo[] {
  return [
    getSMSPresetInfo("starter"),
    getSMSPresetInfo("production"),
    getSMSPresetInfo("enterprise"),
    getSMSPresetInfo("custom"),
  ];
}

/**
 * Compare two configurations to determine upgrade path
 */
export function getSMSUpgradePath(
  current: WrapsSMSConfig,
  target: WrapsSMSConfig
): string[] {
  const changes: string[] = [];

  // Check phone number type upgrade
  if (current.phoneNumberType !== target.phoneNumberType) {
    changes.push(
      `Upgrade phone number: ${current.phoneNumberType || "none"} → ${target.phoneNumberType}`
    );
  }

  // Check event tracking
  if (!current.eventTracking?.enabled && target.eventTracking?.enabled) {
    changes.push("Enable real-time event tracking");
  }

  // Check DynamoDB history
  if (
    !current.eventTracking?.dynamoDBHistory &&
    target.eventTracking?.dynamoDBHistory
  ) {
    changes.push("Enable message history storage");
  }

  // Check retention upgrade
  if (
    current.eventTracking?.archiveRetention !==
      target.eventTracking?.archiveRetention &&
    target.eventTracking?.archiveRetention
  ) {
    changes.push(
      `Upgrade retention: ${current.eventTracking?.archiveRetention || "none"} → ${target.eventTracking.archiveRetention}`
    );
  }

  // Check message archiving
  if (!current.messageArchiving?.enabled && target.messageArchiving?.enabled) {
    changes.push("Enable message content archiving");
  }

  // Check link tracking
  if (!current.tracking?.linkTracking && target.tracking?.linkTracking) {
    changes.push("Enable link click tracking");
  }

  return changes;
}

/**
 * Validate configuration for common issues
 */
export function validateSMSConfig(config: WrapsSMSConfig): string[] {
  const warnings: string[] = [];

  // Warn about simulator in production
  if (config.phoneNumberType === "simulator") {
    warnings.push(
      "Simulator numbers cannot send real SMS. Use toll-free for production."
    );
  }

  // Warn about toll-free registration
  if (config.phoneNumberType === "toll-free") {
    warnings.push(
      "Toll-free numbers require registration (~15 business days). Run 'wraps sms register' after setup."
    );
  }

  // Warn about event tracking without storage
  if (config.eventTracking?.enabled && !config.eventTracking?.dynamoDBHistory) {
    warnings.push(
      "Event tracking is enabled but history storage is disabled. Events will only be available in real-time."
    );
  }

  // Warn about long retention
  if (config.eventTracking?.archiveRetention === "indefinite") {
    warnings.push(
      "Indefinite retention can become expensive. Consider 90-day or 1-year retention."
    );
  }

  return warnings;
}
