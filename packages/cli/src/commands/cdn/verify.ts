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
export type CdnVerifyOptions = {
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
 * Check CloudFront distribution status and configured aliases
 */
async function checkDistributionStatus(
  distributionId: string,
  region: string
): Promise<{ status: string; enabled: boolean; aliases: string[] }> {
  try {
    const { CloudFrontClient, GetDistributionCommand } = await import(
      "@aws-sdk/client-cloudfront"
    );
    const cf = new CloudFrontClient({ region });

    const result = await cf.send(
      new GetDistributionCommand({ Id: distributionId })
    );

    const aliases =
      result.Distribution?.DistributionConfig?.Aliases?.Items || [];

    return {
      status: result.Distribution?.Status || "UNKNOWN",
      enabled: result.Distribution?.DistributionConfig?.Enabled ?? false,
      aliases,
    };
  } catch (_error: any) {
    return { status: "ERROR", enabled: false, aliases: [] };
  }
}

/**
 * Storage Verify command - Check DNS and certificate status
 */
export async function cdnVerify(
  options: CdnVerifyOptions
): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps CDN Verification"));

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Loading CDN infrastructure",
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
    const cdnConnections = await findConnectionsWithService(
      identity.accountId,
      "cdn"
    );

    if (cdnConnections.length === 1) {
      region = cdnConnections[0].region;
    } else if (cdnConnections.length > 1) {
      const selectedRegion = await clack.select({
        message: "Multiple CDN deployments found. Which region?",
        options: cdnConnections.map((conn) => ({
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
      stackName: `wraps-cdn-${identity.accountId}-${region}`,
      workDir: getPulumiWorkDir(),
    });

    stackOutputs = await stack.outputs();
  } catch (_error: any) {
    progress.stop();
    clack.log.error("No CDN infrastructure found");
    console.log(
      `\nRun ${pc.cyan("wraps cdn init")} to deploy CDN infrastructure.\n`
    );
    process.exit(1);
  }

  progress.stop();

  // Get stack outputs - note: customDomain vs customDomainPending reflects deployment state,
  // not current reality. We need to check actual certificate and DNS status.
  const stackCustomDomain = stackOutputs.customDomain?.value;
  const stackCustomDomainPending = stackOutputs.customDomainPending?.value;
  const distributionId = stackOutputs.distributionId?.value;
  const distributionDomain = stackOutputs.distributionDomain?.value;
  const acmCertificateArn = stackOutputs.acmCertificateArn?.value;
  const validationRecords = stackOutputs.acmCertificateValidationRecords
    ?.value as Array<{ name: string; type: string; value: string }> | undefined;

  // The domain we're checking - either active or pending in stack outputs
  const targetDomain = stackCustomDomain || stackCustomDomainPending;

  let allPassed = true;
  let cloudFrontAliases: string[] = [];

  // 4. Check CloudFront status
  if (distributionId) {
    clack.log.info(`\n${pc.bold("CloudFront Distribution:")}`);

    const distStatus = await checkDistributionStatus(distributionId, region);
    cloudFrontAliases = distStatus.aliases;

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

  // 5. Check certificate and custom domain status
  // We check actual state (cert issued + DNS configured) rather than relying on stack outputs
  if (acmCertificateArn && targetDomain && distributionDomain) {
    const certStatus = await checkCertificateStatus(acmCertificateArn);
    const domainCheck = await checkDNSRecord(targetDomain, distributionDomain);

    // Check if domain is already configured as a CloudFront alias
    const domainInCloudFrontAliases = cloudFrontAliases.some(
      (alias) => alias.toLowerCase() === targetDomain.toLowerCase()
    );

    clack.log.info(`\n${pc.bold("SSL Certificate:")}`);

    if (certStatus.status === "ISSUED") {
      clack.log.success(`  Certificate: ${pc.green("Issued and valid")}`);
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

    // Check custom domain CNAME
    clack.log.info(`\n${pc.bold("Custom Domain DNS:")}`);

    if (domainCheck.found) {
      clack.log.success(
        `  ${pc.green("OK")} ${targetDomain} → ${distributionDomain}`
      );
    } else {
      clack.log.error(`  ${pc.red("MISSING")} ${targetDomain}`);
      clack.log.info(`    ${pc.dim("→")} Add CNAME: ${distributionDomain}`);
      allPassed = false;
    }

    // Check CloudFront alias configuration
    if (domainInCloudFrontAliases) {
      clack.log.success(
        `  ${pc.green("OK")} CloudFront alias configured for ${targetDomain}`
      );
    } else if (certStatus.status === "ISSUED" && domainCheck.found) {
      // Cert is valid and DNS is configured, but CloudFront doesn't have the alias yet
      clack.log.warn(
        `  ${pc.yellow("!")} CloudFront alias not configured for ${targetDomain}`
      );
      clack.log.info(
        `    Run ${pc.cyan("wraps cdn upgrade")} to add the custom domain to CloudFront.`
      );
      allPassed = false;
    }
  } else if (acmCertificateArn && targetDomain) {
    // Has certificate but no distribution domain yet
    clack.log.info(`\n${pc.bold("SSL Certificate:")}`);
    const certStatus = await checkCertificateStatus(acmCertificateArn);

    if (certStatus.status === "ISSUED") {
      clack.log.success(`  Certificate: ${pc.green("Issued and valid")}`);
    } else if (certStatus.status === "PENDING_VALIDATION") {
      clack.log.warn(`  Certificate: ${pc.yellow("Pending validation")}`);
      allPassed = false;

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

  // Check if stack outputs are stale (everything working but stack shows pending)
  const stackOutputsStale =
    allPassed &&
    stackCustomDomainPending &&
    !stackCustomDomain &&
    targetDomain &&
    cloudFrontAliases.some(
      (alias) => alias.toLowerCase() === targetDomain.toLowerCase()
    );

  // 7. Summary
  clack.log.info("");
  if (allPassed) {
    clack.log.success(pc.green(pc.bold("All checks passed!")));

    const cdnUrl = targetDomain
      ? `https://${targetDomain}`
      : distributionDomain
        ? `https://${distributionDomain}`
        : null;

    if (cdnUrl) {
      clack.log.info(`\nYour CDN is accessible at: ${pc.cyan(cdnUrl)}`);
    }

    // Suggest sync if stack outputs are stale
    if (stackOutputsStale) {
      clack.log.info(
        `\n${pc.dim("Tip:")} Run ${pc.cyan("wraps cdn sync")} to update infrastructure state.`
      );
    }
  } else {
    clack.log.warn(pc.yellow("Some checks failed. See details above."));

    if (validationRecords && validationRecords.length > 0) {
      clack.log.info("\nDNS records may take up to 48 hours to propagate.");
      clack.log.info(
        `Run ${pc.cyan("wraps cdn verify")} again to check status.`
      );
    }
  }

  // 8. Track verify command
  trackCommand("storage:verify", {
    success: allPassed,
    region,
    has_custom_domain: !!targetDomain,
    duration_ms: Date.now() - startTime,
  });

  clack.outro("");
}
