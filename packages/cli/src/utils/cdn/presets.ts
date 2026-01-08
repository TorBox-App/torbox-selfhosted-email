import type {
  CdnConfigPreset,
  WrapsCdnConfig,
} from "../../types/index.js";
import { calculateCosts, formatCost } from "./costs.js";

/**
 * Starter preset - basic storage with CDN
 * Perfect for: Side projects, MVPs, low-volume uploads
 * Storage: Up to 10GB
 * Cost: ~$5-7/month
 */
export const STARTER_PRESET: WrapsCdnConfig = {
  cdn: {
    enabled: true,
    priceClass: "PriceClass_100", // US, Canada, Europe only (cheapest)
    originShield: false,
    geoRestriction: { type: "none" },
  },
  versioning: false,
  encryption: "aes256",
  retention: "none", // Keep forever
};

/**
 * Production preset - storage with custom domain
 * Perfect for: Production apps, branded CDN URLs
 * Storage: 10GB-100GB
 * Cost: ~$10-50/month (depends on bandwidth)
 */
export const PRODUCTION_PRESET: WrapsCdnConfig = {
  cdn: {
    enabled: true,
    // customDomain will be set during init
    priceClass: "PriceClass_All", // Global edge coverage
    originShield: true, // Reduce origin requests by ~80%
    geoRestriction: { type: "none" }, // Accessible globally
  },
  versioning: true,
  encryption: "aes256",
  retention: "none", // Keep forever
};

/**
 * Get preset configuration by name
 */
export function getPreset(
  preset: CdnConfigPreset
): WrapsCdnConfig | null {
  switch (preset) {
    case "starter":
      return { ...STARTER_PRESET };
    case "production":
      return { ...PRODUCTION_PRESET };
    case "custom":
      return null; // User will configure manually
  }
}

/**
 * Preset metadata for display
 */
export type StoragePresetInfo = {
  name: string;
  description: string;
  recommended: string;
  estimatedCost: string;
  features: string[];
};

/**
 * Get preset information for display
 */
export function getPresetInfo(preset: CdnConfigPreset): StoragePresetInfo {
  const config = getPreset(preset);

  if (preset === "custom" || !config) {
    return {
      name: "Custom",
      description: "Configure each feature individually",
      recommended: "Advanced users who need specific configuration",
      estimatedCost: "Varies",
      features: ["Full control over all features"],
    };
  }

  const costs = calculateCosts(
    config,
    preset === "starter" ? 5 : 25, // Storage GB
    preset === "starter" ? 20 : 100 // Bandwidth GB
  );

  const baseInfo = {
    starter: {
      name: "Starter",
      description: "Basic storage with CloudFront CDN",
      recommended: "Side projects, MVPs, low-volume uploads",
      features: [
        "S3 bucket with AES-256 encryption",
        "CloudFront CDN (US/Canada/Europe edges)",
        "CORS configured for dashboard",
        "No auto-cleanup (keep files forever)",
      ],
    },
    production: {
      name: "Production",
      description: "Storage with custom domain and global CDN",
      recommended: "Production apps, branded CDN URLs (RECOMMENDED)",
      features: [
        "Everything in Starter",
        "Custom CDN domain (cdn.yourdomain.com)",
        "SSL certificate (ACM)",
        "Global edge locations (400+)",
        "Origin Shield (80% fewer origin requests)",
        "S3 versioning enabled",
      ],
    },
  }[preset];

  return {
    ...baseInfo,
    estimatedCost: formatCost(costs.total.monthly),
  } as StoragePresetInfo;
}

/**
 * Get all preset options for CLI prompts
 */
export function getAllPresetInfo(): StoragePresetInfo[] {
  return [
    getPresetInfo("starter"),
    getPresetInfo("production"),
    getPresetInfo("custom"),
  ];
}

/**
 * Validate CDN configuration for common issues
 */
export function validateConfig(config: WrapsCdnConfig): string[] {
  const warnings: string[] = [];

  // Warn about no CDN
  if (!config.cdn.enabled) {
    warnings.push(
      "⚠️  CDN is disabled. Files will be served directly from S3, which may be slower and more expensive for high traffic."
    );
  }

  // Warn about custom domain without HTTPS
  if (config.cdn.customDomain && !config.cdn.enabled) {
    warnings.push(
      "⚠️  Custom domain is set but CDN is disabled. Custom domains require CloudFront."
    );
  }

  // Warn about versioning costs
  if (config.versioning) {
    warnings.push(
      "💡 Versioning is enabled. Old versions of files will be kept and count towards storage costs."
    );
  }

  // Warn about short retention
  if (config.retention && config.retention !== "none") {
    warnings.push(
      `💡 Auto-cleanup is enabled. Files will be deleted after ${config.retention}.`
    );
  }

  return warnings;
}

/**
 * Merge user configuration with preset defaults
 */
export function mergeWithPreset(
  preset: CdnConfigPreset,
  overrides: Partial<WrapsCdnConfig>
): WrapsCdnConfig {
  const base = getPreset(preset) || STARTER_PRESET;

  return {
    ...base,
    ...overrides,
    cdn: {
      ...base.cdn,
      ...overrides.cdn,
    },
  };
}
