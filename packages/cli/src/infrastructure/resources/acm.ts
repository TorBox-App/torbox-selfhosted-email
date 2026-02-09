import { ACMClient, DescribeCertificateCommand } from "@aws-sdk/client-acm";
import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";

/**
 * Check if an ACM certificate for the domain is already validated
 * This is used to determine if CloudFront can be created (requires validated cert)
 */
export async function checkCertificateValidation(
  domain: string
): Promise<boolean> {
  try {
    // ACM for CloudFront must be in us-east-1
    const acm = new ACMClient({ region: "us-east-1" });

    // List certificates to find one matching our domain
    const { ListCertificatesCommand } = await import("@aws-sdk/client-acm");
    const listResponse = await acm.send(
      new ListCertificatesCommand({
        CertificateStatuses: ["ISSUED"],
      })
    );

    // Find a certificate for our domain that is ISSUED (validated)
    const cert = listResponse.CertificateSummaryList?.find(
      (c) => c.DomainName === domain
    );

    if (cert?.CertificateArn) {
      // Double-check the status
      const describeResponse = await acm.send(
        new DescribeCertificateCommand({
          CertificateArn: cert.CertificateArn,
        })
      );
      return describeResponse.Certificate?.Status === "ISSUED";
    }

    return false;
  } catch (error) {
    // If we can't check, assume not validated to be safe
    return false;
  }
}

/**
 * ACM certificate configuration
 */
export type ACMCertificateConfig = {
  domain: string;
  hostedZoneId?: string; // Optional Route53 hosted zone for automatic DNS validation
};

/**
 * ACM certificate output
 */
export type ACMCertificateResources = {
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
export async function createACMCertificate(
  config: ACMCertificateConfig
): Promise<ACMCertificateResources> {
  const usEast1Provider = new aws.Provider("acm-us-east-1", {
    region: "us-east-1",
  });

  // Create ACM certificate in us-east-1 (required for CloudFront)
  const certificate = new aws.acm.Certificate(
    "wraps-email-tracking-cert",
    {
      domainName: config.domain,
      validationMethod: "DNS",
      tags: {
        ManagedBy: "wraps-cli",
        Description: "SSL certificate for Wraps email tracking domain",
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
      "wraps-email-tracking-cert-validation",
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
      "wraps-email-tracking-cert-validation-waiter",
      {
        certificateArn: certificate.arn,
        validationRecordFqdns: [validationRecord.fqdn],
      },
      {
        provider: usEast1Provider,
      }
    );
  }
  // For manual DNS: certificateValidation is undefined
  // User must add DNS records manually and run upgrade again

  return {
    certificate,
    certificateValidation,
    validationRecords,
  };
}
