import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import type { TransformFunctions } from "../types.js";

/**
 * ACM certificate result
 */
export type ACMResult = {
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
 * Create ACM certificate for custom tracking domain
 *
 * IMPORTANT: CloudFront requires ACM certificates to be created in us-east-1 region.
 * This function creates the certificate in us-east-1 regardless of the SES region.
 *
 * If a Route53 hosted zone ID is provided, DNS validation records will be created
 * automatically and we'll wait for validation. Otherwise, validation records are
 * returned for manual creation.
 */
export function createACMCertificate(
  name: string,
  domain: string,
  hostedZoneId: string | undefined,
  tags: Record<string, string>,
  transform: TransformFunctions["certificate"] | undefined,
  opts?: pulumi.ComponentResourceOptions
): ACMResult {
  // CloudFront requires ACM certs in us-east-1
  const usEast1Provider = new aws.Provider(
    `${name}-acm-us-east-1`,
    { region: "us-east-1" },
    opts
  );

  // Certificate configuration
  let certArgs: aws.acm.CertificateArgs = {
    domainName: domain,
    validationMethod: "DNS",
    tags: {
      ...tags,
      Description: "SSL certificate for Wraps email tracking domain",
    },
  };

  // Apply transform if provided
  if (transform) {
    certArgs = transform(certArgs);
  }

  const certificate = new aws.acm.Certificate(
    `${name}-tracking-cert`,
    certArgs,
    { ...opts, provider: usEast1Provider }
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

  if (hostedZoneId) {
    // Create validation record in Route53
    const validationRecord = new aws.route53.Record(
      `${name}-cert-validation-record`,
      {
        zoneId: hostedZoneId,
        name: certificate.domainValidationOptions[0].resourceRecordName,
        type: certificate.domainValidationOptions[0].resourceRecordType,
        records: [certificate.domainValidationOptions[0].resourceRecordValue],
        ttl: 60,
      },
      opts
    );

    // Wait for certificate validation to complete
    certificateValidation = new aws.acm.CertificateValidation(
      `${name}-cert-validation`,
      {
        certificateArn: certificate.arn,
        validationRecordFqdns: [validationRecord.fqdn],
      },
      { ...opts, provider: usEast1Provider }
    );
  }

  return {
    certificate,
    certificateValidation,
    validationRecords,
  };
}
