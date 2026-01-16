import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import type { TransformFunctions } from "../types.js";

/**
 * CloudFront distribution result
 */
export type CloudFrontResult = {
  distribution: aws.cloudfront.Distribution;
  domainName: pulumi.Output<string>;
  webAcl?: aws.wafv2.WebAcl;
};

/**
 * Create WAF Web ACL with rate limiting for CloudFront
 *
 * This creates a WAFv2 Web ACL with rate limiting protection
 * to prevent abuse of tracking endpoints.
 */
function createWAFWebACL(
  name: string,
  tags: Record<string, string>,
  opts?: pulumi.ComponentResourceOptions
): aws.wafv2.WebAcl {
  // WAF for CloudFront must be created in us-east-1
  const usEast1Provider = new aws.Provider(
    `${name}-waf-us-east-1`,
    { region: "us-east-1" },
    opts
  );

  return new aws.wafv2.WebAcl(
    `${name}-tracking-waf`,
    {
      scope: "CLOUDFRONT",
      description: "Rate limiting protection for Wraps email tracking",

      defaultAction: {
        allow: {},
      },

      rules: [
        {
          name: "RateLimitRule",
          priority: 1,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 2000, // 2000 requests per 5 minutes per IP
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudwatchMetricsEnabled: true,
            metricName: "RateLimitRule",
          },
        },
      ],

      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudwatchMetricsEnabled: true,
        metricName: "wraps-email-tracking-waf",
      },

      tags: {
        ...tags,
        Description: "WAF for Wraps email tracking with rate limiting",
      },
    },
    { ...opts, provider: usEast1Provider }
  );
}

/**
 * Create CloudFront distribution for HTTPS tracking domain
 *
 * This creates a CloudFront distribution that sits in front of AWS SES's tracking endpoint
 * (r.{region}.awstrack.me) and provides HTTPS support with a custom domain and SSL certificate.
 * Optionally creates a WAF Web ACL with rate limiting for security.
 */
export function createCloudFrontTracking(
  name: string,
  customTrackingDomain: string,
  region: pulumi.Output<string>,
  certificateArn: pulumi.Output<string>,
  wafEnabled: boolean,
  tags: Record<string, string>,
  transform: TransformFunctions["distribution"] | undefined,
  opts?: pulumi.ComponentResourceOptions
): CloudFrontResult {
  // Create WAF Web ACL if enabled
  const webAcl = wafEnabled ? createWAFWebACL(name, tags, opts) : undefined;

  // SES tracking origin domain
  const sesTrackingOrigin = region.apply((r) => `r.${r}.awstrack.me`);

  // CloudFront distribution configuration
  let distributionArgs: aws.cloudfront.DistributionArgs = {
    enabled: true,
    comment: "Wraps email tracking with HTTPS support",
    aliases: [customTrackingDomain],

    // Attach WAF Web ACL for rate limiting protection (only if enabled)
    webAclId: webAcl?.arn,

    // Origin: SES tracking endpoint
    origins: [
      {
        domainName: sesTrackingOrigin,
        originId: "ses-tracking",
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "http-only", // SES tracking endpoint is HTTP
          originSslProtocols: ["TLSv1.2"],
        },
      },
    ],

    // Default cache behavior
    defaultCacheBehavior: {
      targetOriginId: "ses-tracking",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD"],

      // Forward all query strings and headers (tracking links use query params)
      forwardedValues: {
        queryString: true,
        cookies: {
          forward: "all",
        },
        headers: ["*"],
      },

      // Minimal caching for tracking redirects
      minTtl: 0,
      defaultTtl: 0,
      maxTtl: 31_536_000,

      compress: true,
    },

    // Price class (use only North America & Europe for cost optimization)
    priceClass: "PriceClass_100",

    // Restrictions (none)
    restrictions: {
      geoRestriction: {
        restrictionType: "none",
      },
    },

    // SSL certificate from ACM
    viewerCertificate: {
      acmCertificateArn: certificateArn,
      sslSupportMethod: "sni-only",
      minimumProtocolVersion: "TLSv1.2_2021",
    },

    tags: {
      ...tags,
      Description: "Wraps email tracking CloudFront distribution",
    },
  };

  // Apply transform if provided
  if (transform) {
    distributionArgs = transform(distributionArgs);
  }

  const distribution = new aws.cloudfront.Distribution(
    `${name}-tracking-cdn`,
    distributionArgs,
    opts
  );

  return {
    distribution,
    domainName: distribution.domainName,
    webAcl,
  };
}

/**
 * Create HTTPS tracking resources (ACM + CloudFront)
 *
 * This is the main entry point for setting up HTTPS tracking.
 * It creates:
 * 1. ACM certificate (in us-east-1 for CloudFront)
 * 2. Optional Route53 validation record
 * 3. CloudFront distribution
 * 4. Optional WAF Web ACL
 */
export function createHTTPSTracking(
  name: string,
  config: {
    customTrackingDomain: string;
    region: pulumi.Output<string>;
    hostedZoneId?: string;
    wafEnabled: boolean;
  },
  tags: Record<string, string>,
  transform: TransformFunctions | undefined,
  opts?: pulumi.ComponentResourceOptions
): {
  cloudfront: CloudFrontResult;
  acmCertificateArn: pulumi.Output<string>;
  acmValidationRecords: pulumi.Output<
    Array<{ name: string; type: string; value: string }>
  >;
} {
  // Import ACM functions
  const { createACMCertificate } = require("./acm.js");

  // Create ACM certificate
  const acmResult = createACMCertificate(
    name,
    config.customTrackingDomain,
    config.hostedZoneId,
    tags,
    transform?.certificate,
    opts
  );

  // Determine certificate ARN to use
  // If validation was set up (Route53), use the validated cert ARN
  // Otherwise use the certificate ARN directly (user will need to validate manually)
  const certificateArn = acmResult.certificateValidation
    ? acmResult.certificateValidation.certificateArn
    : acmResult.certificate.arn;

  // Create CloudFront distribution
  const cloudfront = createCloudFrontTracking(
    name,
    config.customTrackingDomain,
    config.region,
    certificateArn,
    config.wafEnabled,
    tags,
    transform?.distribution,
    opts
  );

  return {
    cloudfront,
    acmCertificateArn: acmResult.certificate.arn,
    acmValidationRecords: acmResult.validationRecords,
  };
}
