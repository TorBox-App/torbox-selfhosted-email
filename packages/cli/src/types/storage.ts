/**
 * Storage-specific types for Wraps
 * S3 + CloudFront infrastructure deployed to user's AWS account
 */

import type { FeatureCost, Provider } from "./shared.js";

/**
 * Storage retention periods for auto-cleanup
 */
export type StorageRetention =
  | "none" // Keep forever
  | "30days"
  | "60days"
  | "90days"
  | "180days"
  | "1year";

/**
 * CloudFront price class - controls which edge locations cache content
 * More edges = higher cost but lower latency globally
 */
export type CloudFrontPriceClass =
  | "PriceClass_All" // All 400+ edge locations globally (default)
  | "PriceClass_200" // US, Canada, Europe, Asia, Middle East, Africa (not SA/AU)
  | "PriceClass_100"; // US, Canada, Europe only (cheapest)

/**
 * Geographic restriction for CloudFront
 * Controls which countries can ACCESS content (not just caching)
 */
export type GeoRestriction = {
  type: "whitelist" | "blacklist" | "none";
  /**
   * ISO 3166-1 alpha-2 country codes
   * Examples: "US", "CA", "GB", "DE", "FR", "JP", "AU"
   * Full list: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
   */
  countries?: string[];
};

/**
 * Feature-based storage configuration
 */
export type WrapsStorageConfig = {
  // Bucket configuration
  bucketName?: string; // Auto-generated if not provided: wraps-storage-{accountId}

  // CDN configuration
  cdn: {
    enabled: boolean;
    customDomain?: string; // e.g., cdn.example.com

    /**
     * Price class - which edge locations to use
     * Default: PriceClass_All (global coverage)
     */
    priceClass?: CloudFrontPriceClass;

    /**
     * Origin Shield - extra caching layer between edges and S3
     * Reduces origin requests by ~80% for popular content
     * Region is auto-set to match S3 bucket region
     */
    originShield?: boolean;

    /**
     * Geographic restriction - block/allow specific countries
     * Default: none (accessible globally)
     */
    geoRestriction?: GeoRestriction;

    /**
     * Enable WAF Web ACL with rate limiting protection
     * Default: false (no WAF)
     */
    wafEnabled?: boolean;
  };

  // Storage options
  versioning?: boolean; // Enable S3 versioning
  encryption?: "aes256"; // AES-256 encryption (default)

  // Auto-cleanup (lifecycle rules)
  retention?: StorageRetention;

  // CORS origins (in addition to defaults)
  additionalOrigins?: string[];
};

/**
 * Configuration preset types for storage
 */
export type StorageConfigPreset = "starter" | "production" | "custom";

/**
 * Feature cost breakdown for storage
 */
export type StorageFeatureCostBreakdown = {
  storage?: FeatureCost;
  bandwidth?: FeatureCost;
  requests?: FeatureCost;
  waf?: FeatureCost;
  total: FeatureCost;
};

/**
 * Storage stack configuration (used by Pulumi)
 */
export type StorageStackConfig = {
  provider: Provider;
  region: string;
  accountId: string;
  vercel?: {
    teamSlug: string;
    projectName: string;
  };
  storageConfig: WrapsStorageConfig;
  /**
   * If true, the ACM certificate has been validated externally (manual DNS).
   * This tells the stack to use the existing certificate even without Route53.
   */
  certValidated?: boolean;
  /**
   * Existing ACM certificate ARN to use (for upgrades where cert is already validated)
   */
  existingCertArn?: string;
};

/**
 * Storage stack outputs from Pulumi
 */
export type StorageStackOutputs = {
  roleArn: string;
  bucketName: string;
  bucketArn: string;
  region: string;

  // CloudFront
  distributionId?: string;
  distributionDomain?: string; // e.g., d1234567890.cloudfront.net
  customDomain?: string; // e.g., cdn.example.com (only set when cert is validated)
  customDomainPending?: string; // Custom domain waiting for manual cert validation

  // Certificate (for custom domain)
  acmCertificateArn?: string;
  acmCertificateValidationRecords?: Array<{
    name: string;
    type: string;
    value: string;
  }>;

  // Configuration
  versioning: boolean;
  retention?: StorageRetention;
};

/**
 * Command options for storage init
 */
export type StorageInitOptions = {
  provider?: Provider;
  region?: string;
  domain?: string; // Custom CDN domain (e.g., cdn.example.com)
  preset?: StorageConfigPreset;
  yes?: boolean; // Skip confirmation prompts
  preview?: boolean;
};

/**
 * Command options for storage status
 */
export type StorageStatusOptions = {
  region?: string;
};

/**
 * Command options for storage verify
 */
export type StorageVerifyOptions = {
  region?: string;
};

/**
 * Command options for storage destroy
 */
export type StorageDestroyOptions = {
  region?: string;
  force?: boolean; // Skip confirmation (destructive)
  preview?: boolean;
};

/**
 * Command options for storage upgrade
 */
export type StorageUpgradeOptions = {
  region?: string;
  yes?: boolean;
  preview?: boolean;
};

/**
 * Available features for Wraps storage infrastructure
 */
export type WrapsStorageFeature =
  | "bucket"
  | "cdn"
  | "customDomain"
  | "versioning"
  | "retention";

/**
 * Storage feature metadata
 */
export type WrapsStorageFeatureMetadata = {
  id: WrapsStorageFeature;
  name: string;
  description: string;
  requires?: WrapsStorageFeature[];
  resources: string[];
};
