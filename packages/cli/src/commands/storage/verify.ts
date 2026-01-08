import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { findConnectionsWithService } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Storage verify command options
 */
export type StorageVerifyOptions = {
  region?: string;
};

/**
 * Check DNS record for a domain
 */
async function checkDNSRecord(
  hostname: string,
  expectedValue: string
): Promise<{ found: boolean; value?: string }> {
  try {
    const { resolve } = await import("node:dns/promises");
    const records = await resolve(hostname, "CNAME");

    // Check if any record matches (removing trailing dots)
    const normalizedExpected = expectedValue.replace(/\.$/, "").toLowerCase();
    const found = records.some(
      (r) => r.replace(/\.$/, "").toLowerCase() === normalizedExpected
    );

    return { found, value: records[0] };
  } catch (_error: any) {
    return { found: false };
  }
}

/**
 * Check ACM certificate status
 */
async function checkCertificateStatus(
  certificateArn: string
): Promise<{ status: string; validationStatus?: string }> {
  try {
    const { ACMClient, DescribeCertificateCommand } = await import(
      "@aws-sdk/client-acm"
    );
    const acm = new ACMClient({ region: "us-east-1" }); // ACM for CloudFront is always us-east-1

    const result = await acm.send(
      new DescribeCertificateCommand({ CertificateArn: certificateArn })
    );

    const cert = result.Certificate;
    const validationStatus =
      cert?.DomainValidationOptions?.[0]?.ValidationStatus;

    return {
      status: cert?.Status || "UNKNOWN",
      validationStatus,
    };
  } catch (_error: any) {
    return { status: "ERROR" };
  }
}

/**
 * Check CloudFront distribution status
 */
async function checkDistributionStatus(
  distributionId: string,
  region: string
): Promise<{ status: string; enabled: boolean }> {
  try {
    const { CloudFrontClient, GetDistributionCommand } = await import(
      "@aws-sdk/client-cloudfront"
    );
    const cf = new CloudFrontClient({ region });

    const result = await cf.send(
      new GetDistributionCommand({ Id: distributionId })
    );

    return {
      status: result.Distribution?.Status || "UNKNOWN",
      enabled: result.Distribution?.DistributionConfig?.Enabled ?? false,
    };
  } catch (_error: any) {
    return { status: "ERROR", enabled: false };
  }
}

/**
 * Storage Verify command - Check DNS and certificate status
 */
export async function storageVerify(
  options: StorageVerifyOptions
): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps Storage Verification"));

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Loading storage infrastructure",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  let region = options.region || (await getAWSRegion());

  // If no region specified, try to find from metadata
  if (
    !(
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION
    )
  ) {
    const storageConnections = await findConnectionsWithService(
      identity.accountId,
      "storage"
    );

    if (storageConnections.length === 1) {
      region = storageConnections[0].region;
    } else if (storageConnections.length > 1) {
      const selectedRegion = await clack.select({
        message: "Multiple storage deployments found. Which region?",
        options: storageConnections.map((conn) => ({
          value: conn.region,
          label: conn.region,
        })),
      });

      if (clack.isCancel(selectedRegion)) {
        clack.cancel("Operation cancelled");
        process.exit(0);
      }

      region = selectedRegion as string;
    }
  }

  // 3. Load Pulumi stack
  let stackOutputs: any = {};
  try {
    await ensurePulumiWorkDir();

    const stack = await pulumi.automation.LocalWorkspace.selectStack({
      stackName: `wraps-storage-${identity.accountId}-${region}`,
      workDir: getPulumiWorkDir(),
    });

    stackOutputs = await stack.outputs();
  } catch (_error: any) {
    progress.stop();
    clack.log.error("No storage infrastructure found");
    console.log(
      `\nRun ${pc.cyan("wraps storage init")} to deploy storage infrastructure.\n`
    );
    process.exit(1);
  }

  progress.stop();

  const customDomain = stackOutputs.customDomain?.value;
  const customDomainPending = stackOutputs.customDomainPending?.value;
  const distributionId = stackOutputs.distributionId?.value;
  const distributionDomain = stackOutputs.distributionDomain?.value;
  const acmCertificateArn = stackOutputs.acmCertificateArn?.value;
  const validationRecords = stackOutputs.acmCertificateValidationRecords
    ?.value as Array<{ name: string; type: string; value: string }> | undefined;

  // Derive pending domain from validation records if not explicitly set
  const pendingDomain =
    customDomainPending ||
    (!customDomain && validationRecords?.[0]?.name
      ? validationRecords[0].name.replace(/^_[^.]+\./, "").replace(/\.$/, "")
      : undefined);

  let allPassed = true;

  // 4. Check CloudFront status
  if (distributionId) {
    clack.log.info(`\n${pc.bold("CloudFront Distribution:")}`);

    const distStatus = await checkDistributionStatus(distributionId, region);
    if (distStatus.status === "Deployed" && distStatus.enabled) {
      clack.log.success(`  Status: ${pc.green("Deployed and enabled")}`);
    } else if (distStatus.status === "InProgress") {
      clack.log.warn(
        `  Status: ${pc.yellow("Deploying...")} (this can take 5-10 minutes)`
      );
      allPassed = false;
    } else {
      clack.log.error(`  Status: ${pc.red(distStatus.status)}`);
      allPassed = false;
    }
  }

  // 5. Check certificate status (if custom domain is active OR pending)
  if (acmCertificateArn && (customDomain || pendingDomain)) {
    clack.log.info(`\n${pc.bold("SSL Certificate:")}`);

    if (pendingDomain && !customDomain) {
      clack.log.info(
        `  Domain: ${pc.yellow(pendingDomain)} ${pc.dim("(pending)")}`
      );
    }

    const certStatus = await checkCertificateStatus(acmCertificateArn);

    if (certStatus.status === "ISSUED") {
      clack.log.success(`  Certificate: ${pc.green("Issued and valid")}`);

      // If cert is issued but domain is still pending, suggest upgrade
      if (pendingDomain && !customDomain) {
        clack.log.info(
          `\n  ${pc.green("!")} Certificate validated! Run ${pc.cyan("wraps storage upgrade")} to add custom domain to CloudFront.`
        );
      }
    } else if (certStatus.status === "PENDING_VALIDATION") {
      clack.log.warn(`  Certificate: ${pc.yellow("Pending validation")}`);
      allPassed = false;

      // Check validation DNS records
      if (validationRecords && validationRecords.length > 0) {
        clack.log.info(`\n${pc.bold("Certificate Validation DNS:")}`);

        for (const record of validationRecords) {
          const dnsCheck = await checkDNSRecord(record.name, record.value);
          if (dnsCheck.found) {
            clack.log.success(`  ${pc.green("OK")} ${record.name}`);
          } else {
            clack.log.error(`  ${pc.red("MISSING")} ${record.name}`);
            clack.log.info(`    ${pc.dim("→")} Add CNAME: ${record.value}`);
            allPassed = false;
          }
        }
      }
    } else {
      clack.log.error(`  Certificate: ${pc.red(certStatus.status)}`);
      allPassed = false;
    }
  }

  // 6. Check custom domain CNAME (only if domain is active on CloudFront)
  if (customDomain && distributionDomain) {
    clack.log.info(`\n${pc.bold("Custom Domain DNS:")}`);

    const domainCheck = await checkDNSRecord(customDomain, distributionDomain);
    if (domainCheck.found) {
      clack.log.success(
        `  ${pc.green("OK")} ${customDomain} → ${distributionDomain}`
      );
    } else {
      clack.log.error(`  ${pc.red("MISSING")} ${customDomain}`);
      clack.log.info(`    ${pc.dim("→")} Add CNAME: ${distributionDomain}`);
      allPassed = false;
    }
  }

  // 7. Summary
  clack.log.info("");
  if (allPassed) {
    clack.log.success(pc.green(pc.bold("All checks passed!")));

    const cdnUrl = customDomain
      ? `https://${customDomain}`
      : distributionDomain
        ? `https://${distributionDomain}`
        : null;

    if (cdnUrl) {
      clack.log.info(`\nYour storage is accessible at: ${pc.cyan(cdnUrl)}`);
    }
  } else {
    clack.log.warn(pc.yellow("Some checks failed. See details above."));

    if (validationRecords && validationRecords.length > 0) {
      clack.log.info("\nDNS records may take up to 48 hours to propagate.");
      clack.log.info(
        `Run ${pc.cyan("wraps storage verify")} again to check status.`
      );
    }
  }

  // 8. Track verify command
  trackCommand("storage:verify", {
    success: allPassed,
    region,
    has_custom_domain: !!customDomain,
    duration_ms: Date.now() - startTime,
  });

  clack.outro("");
}
