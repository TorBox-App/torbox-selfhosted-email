import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type {
  StorageRetention,
  WrapsStorageConfig,
} from "../../types/index.js";

/**
 * S3 storage bucket configuration
 */
export type S3StorageConfig = {
  accountId: string;
  region: string;
  storageConfig: WrapsStorageConfig;
};

/**
 * S3 storage resources output
 */
export type S3StorageResources = {
  bucket: aws.s3.BucketV2;
  bucketName: pulumi.Output<string>;
  bucketArn: pulumi.Output<string>;
};

/**
 * Convert retention string to days
 */
function retentionToDays(retention: StorageRetention): number | null {
  switch (retention) {
    case "none":
      return null;
    case "30days":
      return 30;
    case "60days":
      return 60;
    case "90days":
      return 90;
    case "180days":
      return 180;
    case "1year":
      return 365;
    default:
      return null;
  }
}

/**
 * Create S3 bucket for Wraps storage
 */
export async function createStorageBucket(
  config: S3StorageConfig
): Promise<S3StorageResources> {
  const bucketName =
    config.storageConfig.bucketName || `wraps-storage-${config.accountId}`;

  // Create the S3 bucket
  const bucket = new aws.s3.BucketV2("wraps-storage-bucket", {
    bucket: bucketName,
    tags: {
      ManagedBy: "wraps-cli",
      Service: "storage",
    },
  });

  // Enable versioning if configured
  if (config.storageConfig.versioning) {
    new aws.s3.BucketVersioningV2("wraps-storage-versioning", {
      bucket: bucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });
  }

  // Enable AES-256 encryption (always on)
  new aws.s3.BucketServerSideEncryptionConfigurationV2(
    "wraps-storage-encryption",
    {
      bucket: bucket.id,
      rules: [
        {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: "AES256",
          },
        },
      ],
    }
  );

  // Configure CORS for browser uploads
  // Include common dev ports: Vite (5173), Next.js (3000/3001), Wraps Console (5556)
  const corsOrigins = [
    "https://wraps.dev",
    "https://*.wraps.dev",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:4000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5555",
    "http://localhost:5556",
    "http://localhost:8080",
    ...(config.storageConfig.additionalOrigins || []),
  ];

  new aws.s3.BucketCorsConfigurationV2("wraps-storage-cors", {
    bucket: bucket.id,
    corsRules: [
      {
        allowedHeaders: ["*"],
        allowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        allowedOrigins: corsOrigins,
        exposeHeaders: ["ETag", "Content-Length", "Content-Type"],
        maxAgeSeconds: 3600,
      },
    ],
  });

  // Configure lifecycle rules for auto-cleanup if retention is set
  const retentionDays = config.storageConfig.retention
    ? retentionToDays(config.storageConfig.retention)
    : null;

  if (retentionDays) {
    new aws.s3.BucketLifecycleConfigurationV2("wraps-storage-lifecycle", {
      bucket: bucket.id,
      rules: [
        {
          id: "auto-cleanup",
          status: "Enabled",
          expiration: {
            days: retentionDays,
          },
        },
      ],
    });
  }

  // Block public access - files are only accessible via CloudFront
  new aws.s3.BucketPublicAccessBlock("wraps-storage-public-access", {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });

  return {
    bucket,
    bucketName: bucket.bucket,
    bucketArn: bucket.arn,
  };
}

/**
 * CloudFront storage CDN configuration
 */
export type CloudFrontStorageConfig = {
  bucket: aws.s3.BucketV2;
  bucketRegion: string; // For Origin Shield region
  customDomain?: string;
  certificateArn?: pulumi.Output<string>;
  priceClass?: "PriceClass_All" | "PriceClass_200" | "PriceClass_100";
  originShield?: boolean;
  geoRestriction?: {
    type: "whitelist" | "blacklist" | "none";
    countries?: string[];
  };
  wafEnabled?: boolean; // Enable WAF Web ACL with rate limiting
};

/**
 * CloudFront storage resources output
 */
export type CloudFrontStorageResources = {
  distribution: aws.cloudfront.Distribution;
  domainName: pulumi.Output<string>;
  distributionId: pulumi.Output<string>;
  originAccessControl: aws.cloudfront.OriginAccessControl;
  webAcl?: aws.wafv2.WebAcl;
};

/**
 * Create WAF Web ACL with rate limiting for storage CDN
 */
async function createStorageWAF(): Promise<aws.wafv2.WebAcl> {
  // WAF for CloudFront must be created in us-east-1
  const usEast1Provider = new aws.Provider("storage-waf-us-east-1", {
    region: "us-east-1",
  });

  const webAcl = new aws.wafv2.WebAcl(
    "wraps-storage-waf",
    {
      scope: "CLOUDFRONT", // WAF for CloudFront must use CLOUDFRONT scope
      description: "Rate limiting protection for Wraps storage CDN",

      defaultAction: {
        allow: {}, // Allow by default
      },

      rules: [
        {
          name: "RateLimitRule",
          priority: 1,
          action: {
            block: {}, // Block requests exceeding rate limit
          },
          statement: {
            rateBasedStatement: {
              limit: 5000, // 5000 requests per 5 minutes per IP (higher than tracking)
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudwatchMetricsEnabled: true,
            metricName: "StorageRateLimitRule",
          },
        },
      ],

      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudwatchMetricsEnabled: true,
        metricName: "wraps-storage-waf",
      },

      tags: {
        Name: "wraps-storage-waf",
        ManagedBy: "wraps-cli",
        Service: "storage",
        Description: "WAF for Wraps storage CDN with rate limiting",
      },
    },
    {
      provider: usEast1Provider,
    }
  );

  return webAcl;
}

/**
 * Create CloudFront distribution for storage CDN
 */
export async function createStorageCDN(
  config: CloudFrontStorageConfig
): Promise<CloudFrontStorageResources> {
  // Create WAF Web ACL with rate limiting protection (only if enabled)
  const webAcl = config.wafEnabled ? await createStorageWAF() : undefined;

  // Create Origin Access Control for S3
  const oac = new aws.cloudfront.OriginAccessControl("wraps-storage-oac", {
    name: "wraps-storage-oac",
    description: "OAC for Wraps storage S3 bucket",
    originAccessControlOriginType: "s3",
    signingBehavior: "always",
    signingProtocol: "sigv4",
  });

  // Build aliases array (only if custom domain is set)
  const aliases = config.customDomain ? [config.customDomain] : undefined;

  // Viewer certificate configuration
  const viewerCertificate = config.certificateArn
    ? {
        acmCertificateArn: config.certificateArn,
        sslSupportMethod: "sni-only" as const,
        minimumProtocolVersion: "TLSv1.2_2021" as const,
      }
    : {
        cloudfrontDefaultCertificate: true,
      };

  // Build origin with optional Origin Shield
  const originConfig: aws.types.input.cloudfront.DistributionOrigin = {
    domainName: config.bucket.bucketRegionalDomainName,
    originId: "s3-storage",
    originAccessControlId: oac.id,
  };

  // Add Origin Shield if enabled (uses bucket region)
  if (config.originShield) {
    originConfig.originShield = {
      enabled: true,
      originShieldRegion: config.bucketRegion,
    };
  }

  // Build geo restriction config
  const geoRestrictionConfig: aws.types.input.cloudfront.DistributionRestrictionsGeoRestriction =
    config.geoRestriction?.type === "whitelist" &&
    config.geoRestriction.countries?.length
      ? {
          restrictionType: "whitelist",
          locations: config.geoRestriction.countries,
        }
      : config.geoRestriction?.type === "blacklist" &&
          config.geoRestriction.countries?.length
        ? {
            restrictionType: "blacklist",
            locations: config.geoRestriction.countries,
          }
        : {
            restrictionType: "none",
          };

  // Create CloudFront distribution
  const distribution = new aws.cloudfront.Distribution("wraps-storage-cdn", {
    enabled: true,
    comment: "Wraps storage CDN",
    aliases,

    // Attach WAF Web ACL for rate limiting protection (only if enabled)
    webAclId: webAcl?.arn,

    // S3 origin (with optional Origin Shield)
    origins: [originConfig],

    // Default cache behavior for static assets
    defaultCacheBehavior: {
      targetOriginId: "s3-storage",
      viewerProtocolPolicy: "redirect-to-https",

      // Allow GET, HEAD, OPTIONS only (uploads go direct to S3 via presigned URLs)
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD", "OPTIONS"],

      // Use CachingOptimized policy for static assets
      cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // CachingOptimized

      // Enable compression
      compress: true,
    },

    // Custom error responses - cache 403 errors briefly (S3 returns 403 for missing files)
    customErrorResponses: [
      {
        errorCode: 403,
        errorCachingMinTtl: 10,
      },
    ],

    // Edge locations (price class)
    // PriceClass_All = global, PriceClass_200 = most regions, PriceClass_100 = US/CA/EU only
    priceClass: config.priceClass || "PriceClass_All",

    // Geographic restrictions
    restrictions: {
      geoRestriction: geoRestrictionConfig,
    },

    // SSL certificate
    viewerCertificate,

    tags: {
      Name: "wraps-storage",
      ManagedBy: "wraps-cli",
      Service: "storage",
    },
  });

  // Create bucket policy to allow CloudFront access
  new aws.s3.BucketPolicy("wraps-storage-bucket-policy", {
    bucket: config.bucket.id,
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [{
        "Sid": "AllowCloudFrontAccess",
        "Effect": "Allow",
        "Principal": {
          "Service": "cloudfront.amazonaws.com"
        },
        "Action": "s3:GetObject",
        "Resource": "${config.bucket.arn}/*",
        "Condition": {
          "StringEquals": {
            "AWS:SourceArn": "${distribution.arn}"
          }
        }
      }]
    }`,
  });

  return {
    distribution,
    domainName: distribution.domainName,
    distributionId: distribution.id,
    originAccessControl: oac,
    webAcl,
  };
}

/**
 * ACM certificate configuration for storage
 */
export type ACMStorageCertificateConfig = {
  domain: string;
  hostedZoneId?: string;
};

/**
 * ACM storage certificate resources output
 */
export type ACMStorageCertificateResources = {
  certificate: aws.acm.Certificate;
  certificateValidation?: aws.acm.CertificateValidation;
  validationRecords: pulumi.Output<
    Array<{
      name: string;
      type: string;
      value: string;
    }>
  >;
};

/**
 * Create ACM certificate for custom storage domain
 *
 * IMPORTANT: CloudFront requires ACM certificates to be created in us-east-1 region.
 */
export async function createStorageACMCertificate(
  config: ACMStorageCertificateConfig
): Promise<ACMStorageCertificateResources> {
  // ACM for CloudFront must be in us-east-1
  const usEast1Provider = new aws.Provider("storage-acm-us-east-1", {
    region: "us-east-1",
  });

  // Create ACM certificate in us-east-1 (required for CloudFront)
  const certificate = new aws.acm.Certificate(
    "wraps-storage-cert",
    {
      domainName: config.domain,
      validationMethod: "DNS",
      tags: {
        ManagedBy: "wraps-cli",
        Service: "storage",
        Description: "SSL certificate for Wraps storage CDN domain",
      },
    },
    {
      provider: usEast1Provider,
    }
  );

  // Extract validation records
  const validationRecords = certificate.domainValidationOptions.apply(
    (options) =>
      options.map((option) => ({
        name: option.resourceRecordName,
        type: option.resourceRecordType,
        value: option.resourceRecordValue,
      }))
  );

  // If Route53 hosted zone is provided, create validation records automatically
  let certificateValidation: aws.acm.CertificateValidation | undefined;

  if (config.hostedZoneId) {
    // Create validation record in Route53
    const validationRecord = new aws.route53.Record(
      "wraps-storage-cert-validation",
      {
        zoneId: config.hostedZoneId,
        name: certificate.domainValidationOptions[0].resourceRecordName,
        type: certificate.domainValidationOptions[0].resourceRecordType,
        records: [certificate.domainValidationOptions[0].resourceRecordValue],
        ttl: 60,
      }
    );

    // Wait for certificate validation to complete
    certificateValidation = new aws.acm.CertificateValidation(
      "wraps-storage-cert-validation-waiter",
      {
        certificateArn: certificate.arn,
        validationRecordFqdns: [validationRecord.fqdn],
      },
      {
        provider: usEast1Provider,
      }
    );
  }

  return {
    certificate,
    certificateValidation,
    validationRecords,
  };
}
