import { Resolver } from "node:dns/promises";
import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { getTelemetryClient } from "../../telemetry/client.js";
import { trackCommand, trackFeature } from "../../telemetry/events.js";
import type {
  AdditionalDomain,
  DomainPurpose,
  EmailVerifyOptions,
} from "../../types/index.js";
import {
  buildEmailDNSRecords,
  createDNSRecordsForProvider,
  detectAvailableDNSProviders,
  formatDNSRecordsForDisplay,
  getDNSCredentials,
  getDNSProviderDisplayName,
} from "../../utils/dns/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import {
  classifyDNSError,
  isAWSNotFoundError,
} from "../../utils/shared/errors.js";
import {
  addDomainToMetadata,
  findConnectionsWithService,
  getAllTrackedDomains,
  getDomainFromMetadata,
  loadConnectionMetadata,
  removeDomainFromMetadata,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import {
  promptDNSProvider,
  promptDomainPurpose,
  promptMailFromSubdomain,
  promptSubdomainSuggestions,
} from "../../utils/shared/prompts.js";

/**
 * Verify domain DNS records and verification status
 */
export async function verifyDomain(options: EmailVerifyOptions): Promise<void> {
  clack.intro(pc.bold(`Verifying ${options.domain}`));

  const progress = new DeploymentProgress();
  const region = await getAWSRegion();

  // 1. Check SES verification status
  const sesClient = new SESv2Client({ region });
  let identity;
  let dkimTokens: string[] = [];
  let mailFromDomain: string | undefined;

  try {
    identity = await progress.execute(
      "Checking SES verification status",
      async () => {
        const response = await sesClient.send(
          new GetEmailIdentityCommand({ EmailIdentity: options.domain })
        );
        return response;
      }
    );

    dkimTokens = identity.DkimAttributes?.Tokens || [];
    mailFromDomain = identity.MailFromAttributes?.MailFromDomain;
  } catch (error) {
    if (isAWSNotFoundError(error)) {
      progress.stop();
      clack.log.error(`Domain ${options.domain} not found in SES`);
      console.log(
        `\nRun ${pc.cyan(`wraps email init --domain ${options.domain}`)} to add this domain.\n`
      );
      process.exit(1);
      return; // Return after process.exit for testing
    }
    throw error;
  }

  // 2. Check DNS records
  const resolver = new Resolver();
  // Use public DNS servers for more reliable results
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const dnsResults: Array<{
    name: string;
    type: string;
    status: string;
    records?: string[];
  }> = [];

  // Check DKIM records
  for (const token of dkimTokens) {
    const dkimRecord = `${token}._domainkey.${options.domain}`;
    try {
      const records = await resolver.resolveCname(dkimRecord);
      const expected = `${token}.dkim.amazonses.com`;
      const found = records.some((r) => r === expected || r === `${expected}.`);
      dnsResults.push({
        name: dkimRecord,
        type: "CNAME",
        status: found ? "verified" : "incorrect",
        records,
      });
    } catch (error) {
      const dnsClass = classifyDNSError(error);
      if (dnsClass === "missing") {
        dnsResults.push({
          name: dkimRecord,
          type: "CNAME",
          status: "missing",
        });
      } else if (dnsClass === "network") {
        dnsResults.push({
          name: dkimRecord,
          type: "CNAME",
          status: "missing",
          records: ["DNS lookup failed (network issue)"],
        });
      } else {
        throw error;
      }
    }
  }

  // Check SPF record
  try {
    const records = await resolver.resolveTxt(options.domain);
    const spfRecord = records.flat().find((r) => r.startsWith("v=spf1"));
    const hasAmazonSES = spfRecord?.includes("include:amazonses.com");
    dnsResults.push({
      name: options.domain,
      type: "TXT (SPF)",
      status: hasAmazonSES ? "verified" : spfRecord ? "incorrect" : "missing",
      records: spfRecord ? [spfRecord] : undefined,
    });
  } catch (error) {
    const dnsClass = classifyDNSError(error);
    if (dnsClass === "missing") {
      dnsResults.push({
        name: options.domain,
        type: "TXT (SPF)",
        status: "missing",
      });
    } else if (dnsClass === "network") {
      dnsResults.push({
        name: options.domain,
        type: "TXT (SPF)",
        status: "missing",
        records: ["DNS lookup failed (network issue)"],
      });
    } else {
      throw error;
    }
  }

  // Check DMARC record
  try {
    const records = await resolver.resolveTxt(`_dmarc.${options.domain}`);
    const dmarcRecord = records.flat().find((r) => r.startsWith("v=DMARC1"));
    dnsResults.push({
      name: `_dmarc.${options.domain}`,
      type: "TXT (DMARC)",
      status: dmarcRecord ? "verified" : "missing",
      records: dmarcRecord ? [dmarcRecord] : undefined,
    });
  } catch (error) {
    const dnsClass = classifyDNSError(error);
    if (dnsClass === "missing") {
      dnsResults.push({
        name: `_dmarc.${options.domain}`,
        type: "TXT (DMARC)",
        status: "missing",
      });
    } else if (dnsClass === "network") {
      dnsResults.push({
        name: `_dmarc.${options.domain}`,
        type: "TXT (DMARC)",
        status: "missing",
        records: ["DNS lookup failed (network issue)"],
      });
    } else {
      throw error;
    }
  }

  // Check MAIL FROM domain records (if configured)
  if (mailFromDomain) {
    // Check MX record for MAIL FROM domain
    try {
      const mxRecords = await resolver.resolveMx(mailFromDomain);
      const expectedMx = `feedback-smtp.${region}.amazonses.com`;
      const hasMx = mxRecords.some(
        (r) => r.exchange === expectedMx || r.exchange === `${expectedMx}.`
      );
      dnsResults.push({
        name: mailFromDomain,
        type: "MX",
        status: hasMx
          ? "verified"
          : mxRecords.length > 0
            ? "incorrect"
            : "missing",
        records: mxRecords.map((r) => `${r.priority} ${r.exchange}`),
      });
    } catch (error) {
      const dnsClass = classifyDNSError(error);
      if (dnsClass === "missing") {
        dnsResults.push({
          name: mailFromDomain,
          type: "MX",
          status: "missing",
        });
      } else if (dnsClass === "network") {
        dnsResults.push({
          name: mailFromDomain,
          type: "MX",
          status: "missing",
          records: ["DNS lookup failed (network issue)"],
        });
      } else {
        throw error;
      }
    }

    // Check SPF record for MAIL FROM domain
    try {
      const records = await resolver.resolveTxt(mailFromDomain);
      const spfRecord = records.flat().find((r) => r.startsWith("v=spf1"));
      const hasAmazonSES = spfRecord?.includes("include:amazonses.com");
      dnsResults.push({
        name: mailFromDomain,
        type: "TXT (SPF)",
        status: hasAmazonSES ? "verified" : spfRecord ? "incorrect" : "missing",
        records: spfRecord ? [spfRecord] : undefined,
      });
    } catch (error) {
      const dnsClass = classifyDNSError(error);
      if (dnsClass === "missing") {
        dnsResults.push({
          name: mailFromDomain,
          type: "TXT (SPF)",
          status: "missing",
        });
      } else if (dnsClass === "network") {
        dnsResults.push({
          name: mailFromDomain,
          type: "TXT (SPF)",
          status: "missing",
          records: ["DNS lookup failed (network issue)"],
        });
      } else {
        throw error;
      }
    }
  }

  progress.stop();

  // 3. Display results
  const verificationStatus = identity.VerifiedForSendingStatus
    ? "verified"
    : "pending";
  const dkimStatus = identity.DkimAttributes?.Status || "PENDING";
  const mailFromStatus =
    identity.MailFromAttributes?.MailFromDomainStatus || "NOT_CONFIGURED";

  const statusLines = [
    `${pc.bold("Domain:")} ${options.domain}`,
    `${pc.bold("Verification Status:")} ${
      verificationStatus === "verified"
        ? pc.green("✓ Verified")
        : pc.yellow("⏱ Pending")
    }`,
    `${pc.bold("DKIM Status:")} ${
      dkimStatus === "SUCCESS"
        ? pc.green("✓ Success")
        : pc.yellow(`⏱ ${dkimStatus}`)
    }`,
  ];

  if (mailFromDomain) {
    statusLines.push(
      `${pc.bold("MAIL FROM Domain:")} ${mailFromDomain}`,
      `${pc.bold("MAIL FROM Status:")} ${
        mailFromStatus === "SUCCESS"
          ? pc.green("✓ Success")
          : mailFromStatus === "NOT_CONFIGURED"
            ? pc.yellow("⏱ Not Configured")
            : pc.yellow(`⏱ ${mailFromStatus}`)
      }`
    );
  }

  clack.note(statusLines.join("\n"), "SES Status");

  // DNS Records
  const dnsLines = dnsResults.map((record) => {
    let statusIcon: string;
    let statusColor: (s: string) => string;

    if (record.status === "verified") {
      statusIcon = "✓";
      statusColor = pc.green;
    } else if (record.status === "incorrect") {
      statusIcon = "✗";
      statusColor = pc.red;
    } else {
      statusIcon = "✗";
      statusColor = pc.red;
    }

    const recordInfo = record.records ? ` → ${record.records.join(", ")}` : "";
    return `  ${statusColor(statusIcon)} ${record.name} (${record.type}) ${statusColor(
      record.status
    )}${recordInfo}`;
  });

  clack.note(dnsLines.join("\n"), "DNS Records");

  // Summary
  const allVerified = dnsResults.every((r) => r.status === "verified");
  const someIncorrect = dnsResults.some((r) => r.status === "incorrect");

  if (verificationStatus === "verified" && allVerified) {
    clack.outro(
      pc.green("✓ Domain is fully verified and ready to send emails!")
    );
    trackFeature("domain_verified", { dns_auto_detected: true });
  } else if (someIncorrect) {
    clack.outro(
      pc.red("✗ Some DNS records are incorrect. Please update them.")
    );
    console.log(
      `\nRun ${pc.cyan("wraps email status")} to see the correct DNS records.\n`
    );
  } else {
    clack.outro(
      pc.yellow("⏱ Waiting for DNS propagation and SES verification")
    );
    console.log("\nDNS records can take up to 48 hours to propagate.");
    console.log(
      "SES verification usually completes within 72 hours after DNS propagation.\n"
    );
  }

  // Track verify command
  trackCommand("email:domains:verify", {
    success: true,
    verified: verificationStatus === "verified" && allVerified,
    dkim_status: dkimStatus,
  });
}

/**
 * Add a domain to SES for email sending.
 *
 * Enhanced flow:
 * 1. Validate AWS creds, load metadata (require email service)
 * 2. Subdomain suggestions when primary domain exists
 * 3. Prompt for purpose
 * 4. Create SES identity with ConfigurationSetName
 * 5. Set up MAIL FROM
 * 6. DNS automation (reuse cached provider or detect fresh)
 * 7. Save to metadata
 * 8. Display success
 */
export async function addDomain(options: {
  domain?: string;
  region?: string;
  yes?: boolean;
}): Promise<void> {
  clack.intro(pc.bold("Add Email Domain"));

  const progress = new DeploymentProgress();

  try {
    // 1. Validate AWS credentials and load metadata
    const identity = await progress.execute(
      "Validating AWS credentials",
      async () => validateAWSCredentials()
    );

    let region = options.region || (await getAWSRegion());

    // Find existing email deployment
    const emailConnections = await findConnectionsWithService(
      identity.accountId,
      "email"
    );

    if (emailConnections.length === 0) {
      progress.stop();
      clack.log.error("No email infrastructure found");
      console.log(
        `\nRun ${pc.cyan("wraps email init")} first to deploy email infrastructure.\n`
      );
      process.exit(1);
      return;
    }

    // Auto-select region if only one deployment
    if (emailConnections.length === 1) {
      region = emailConnections[0].region;
    }

    const metadata = await loadConnectionMetadata(identity.accountId, region);
    if (!metadata?.services.email) {
      progress.stop();
      clack.log.error(`No email service found in ${region}`);
      process.exit(1);
      return;
    }

    const primaryDomain = metadata.services.email.config.domain;

    // 2. Determine domain to add
    let domain = options.domain;

    if (!domain) {
      progress.stop();
      if (primaryDomain) {
        domain = await promptSubdomainSuggestions(primaryDomain);
      } else {
        const entered = await clack.text({
          message: "Domain to add:",
          placeholder: "myapp.com",
          validate: (value) => {
            if (!value?.includes(".")) {
              return "Please enter a valid domain (e.g., myapp.com)";
            }
            return;
          },
        });

        if (clack.isCancel(entered)) {
          clack.cancel("Operation cancelled.");
          process.exit(0);
        }

        domain = entered as string;
      }
    }

    clack.log.step(`Adding ${pc.cyan(domain)}`);

    const sesClient = new SESv2Client({ region });

    // Check if domain already exists in SES
    try {
      await sesClient.send(
        new GetEmailIdentityCommand({ EmailIdentity: domain })
      );
      progress.stop();
      clack.log.warn(`Domain ${domain} already exists in SES`);
      console.log(
        `\nRun ${pc.cyan(`wraps email domains verify --domain ${domain}`)} to check verification status.\n`
      );
      return;
    } catch (error) {
      if (!isAWSNotFoundError(error)) {
        throw error;
      }
    }

    // 3. Prompt for purpose (skip in non-interactive mode)
    let purpose: DomainPurpose = "other";
    if (!options.yes) {
      purpose = await promptDomainPurpose();
    }

    // 4. Create SES identity WITH config set
    const { CreateEmailIdentityCommand } = await import(
      "@aws-sdk/client-sesv2"
    );
    await progress.execute("Creating SES identity", async () => {
      await sesClient.send(
        new CreateEmailIdentityCommand({
          EmailIdentity: domain,
          ConfigurationSetName: "wraps-email-tracking",
          DkimSigningAttributes: {
            NextSigningKeyLength: "RSA_2048_BIT",
          },
        })
      );
    });

    // Get DKIM tokens
    const sesIdentity = await sesClient.send(
      new GetEmailIdentityCommand({ EmailIdentity: domain })
    );
    const dkimTokens = sesIdentity.DkimAttributes?.Tokens || [];

    // 5. Set up MAIL FROM
    let mailFromDomain: string | undefined;
    if (options.yes) {
      // Non-interactive: default to mail.{domain}
      mailFromDomain = `mail.${domain}`;
    } else {
      const wantsMailFrom = await clack.confirm({
        message: `Configure MAIL FROM for ${pc.cyan(domain)}? ${pc.dim("(improves DMARC alignment)")}`,
        initialValue: true,
      });

      if (clack.isCancel(wantsMailFrom)) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }

      if (wantsMailFrom) {
        mailFromDomain = await promptMailFromSubdomain(domain);
      }
    }

    if (mailFromDomain) {
      const { PutEmailIdentityMailFromAttributesCommand } = await import(
        "@aws-sdk/client-sesv2"
      );
      await progress.execute("Setting up MAIL FROM", async () => {
        await sesClient.send(
          new PutEmailIdentityMailFromAttributesCommand({
            EmailIdentity: domain,
            MailFromDomain: mailFromDomain,
            BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
          })
        );
      });
    }

    // 6. DNS automation
    const cachedDnsProvider = metadata.services.email.dnsProvider;
    let dnsAutoCreated = false;

    // Determine the root domain for DNS zone lookups
    // e.g., "mail.myapp.com" → "myapp.com"
    const domainParts = domain.split(".");
    const rootDomain =
      domainParts.length > 2 ? domainParts.slice(-2).join(".") : domain;

    if (!options.yes || cachedDnsProvider) {
      // Try DNS automation
      let dnsProvider = cachedDnsProvider;

      if (!dnsProvider) {
        progress.stop();
        const availableProviders = await detectAvailableDNSProviders(
          rootDomain,
          region
        );
        dnsProvider = await promptDNSProvider(rootDomain, availableProviders);
      }

      if (dnsProvider && dnsProvider !== "manual") {
        const credResult = await getDNSCredentials(
          dnsProvider,
          rootDomain,
          region
        );

        if (credResult.valid && credResult.credentials) {
          const dnsData = {
            domain,
            dkimTokens,
            mailFromDomain,
            region,
          };

          const result = await progress.execute(
            `Creating DNS records via ${getDNSProviderDisplayName(dnsProvider)}`,
            async () =>
              createDNSRecordsForProvider(credResult.credentials!, dnsData)
          );

          if (result.success && result.recordsCreated > 0) {
            dnsAutoCreated = true;
            clack.log.success(
              `${result.recordsCreated} DNS records created via ${getDNSProviderDisplayName(dnsProvider)}`
            );
          } else if (!result.success) {
            clack.log.warn(
              `DNS auto-creation failed: ${result.errors?.join(", ") || "unknown error"}`
            );
          }

          // Cache the dns provider in metadata for future use
          if (!metadata.services.email.dnsProvider) {
            metadata.services.email.dnsProvider = dnsProvider;
          }
        } else {
          clack.log.warn(`DNS credentials not available: ${credResult.error}`);
        }
      }
    }

    // Show manual DNS records if auto-creation was not done
    if (!dnsAutoCreated) {
      const dnsRecords = buildEmailDNSRecords({
        domain,
        dkimTokens,
        mailFromDomain,
        region,
      });
      const displayRecords = formatDNSRecordsForDisplay(dnsRecords);

      progress.stop();
      console.log();
      clack.log.info(pc.bold("Add these DNS records:"));
      console.log();
      for (const record of displayRecords) {
        console.log(`  ${pc.cyan(record.name)}`);
        console.log(
          `    ${pc.dim("Type:")} ${record.type}  ${pc.dim("Value:")} ${record.value}`
        );
        console.log();
      }
    }

    // 7. Save to metadata
    const entry: AdditionalDomain = {
      domain,
      mailFromDomain,
      purpose,
      addedAt: new Date().toISOString(),
    };
    addDomainToMetadata(metadata, entry);
    await saveConnectionMetadata(metadata);

    // 8. Display success
    progress.stop();
    clack.outro(pc.green(`✓ Domain ${domain} added successfully!`));

    if (dnsAutoCreated) {
      console.log(
        `\n${pc.dim("DNS records were created automatically. Verification should complete within a few minutes.")}`
      );
    }

    console.log(`\n${pc.bold("Next steps:")}`);
    console.log(
      `  Verify: ${pc.cyan(`wraps email domains verify --domain ${domain}`)}`
    );
    console.log(`  Status: ${pc.cyan("wraps email status")}\n`);

    // Track success
    trackCommand("email:domains:add", {
      success: true,
      dns_auto_created: dnsAutoCreated,
      has_mail_from: !!mailFromDomain,
      purpose,
    });
    trackFeature("domain_added", {
      purpose,
      subdomain: domain !== primaryDomain,
    });
  } catch (error) {
    progress.stop();
    trackCommand("email:domains:add", { success: false });
    throw error;
  }
}

/**
 * Purpose label map for display
 */
const PURPOSE_LABELS: Record<string, string> = {
  transactional: "Transactional",
  marketing: "Marketing",
  notifications: "Notifications",
  other: "General",
};

/**
 * List all domains configured in SES, cross-referenced with metadata.
 */
export async function listDomains(): Promise<void> {
  clack.intro(pc.bold("SES Email Domains"));

  const progress = new DeploymentProgress();
  const region = await getAWSRegion();
  const sesClient = new SESv2Client({ region });

  try {
    // Load SES domains
    const { ListEmailIdentitiesCommand } = await import(
      "@aws-sdk/client-sesv2"
    );

    const identities = await progress.execute(
      "Loading domains from SES",
      async () => {
        const response = await sesClient.send(
          new ListEmailIdentitiesCommand({})
        );
        return response.EmailIdentities || [];
      }
    );

    // Filter to only domains (not email addresses)
    const sesDomains = identities.filter(
      (identity) =>
        identity.IdentityType === "DOMAIN" ||
        (identity.IdentityName && !identity.IdentityName.includes("@"))
    );

    // Load metadata to cross-reference managed vs unmanaged
    let trackedDomains: ReturnType<typeof getAllTrackedDomains> = [];
    try {
      const awsIdentity = await validateAWSCredentials();
      const metadata = await loadConnectionMetadata(
        awsIdentity.accountId,
        region
      );
      if (metadata) {
        trackedDomains = getAllTrackedDomains(metadata);
      }
    } catch {
      // guardrail:allow-swallowed-error — metadata unavailable is non-fatal, domains show as unmanaged
    }

    const trackedSet = new Map(trackedDomains.map((d) => [d.domain, d]));

    progress.stop();

    if (sesDomains.length === 0) {
      clack.outro("No domains found in SES");
      console.log(
        `\nRun ${pc.cyan("wraps email domains add")} to add a domain.\n`
      );
      return;
    }

    // Get detailed info for each domain
    const domainDetails = await Promise.all(
      sesDomains.map(async (domain) => {
        try {
          const details = await sesClient.send(
            new GetEmailIdentityCommand({
              EmailIdentity: domain.IdentityName!,
            })
          );
          return {
            name: domain.IdentityName!,
            verified: details.VerifiedForSendingStatus,
            dkimStatus: details.DkimAttributes?.Status || "PENDING",
          };
        } catch {
          // guardrail:allow-swallowed-error — individual domain detail fetch failure is non-fatal in listing
          return {
            name: domain.IdentityName!,
            verified: false,
            dkimStatus: "UNKNOWN",
          };
        }
      })
    );

    // Split into managed and unmanaged
    const managed = domainDetails.filter((d) => trackedSet.has(d.name));
    const unmanaged = domainDetails.filter((d) => !trackedSet.has(d.name));

    // Format managed domains
    if (managed.length > 0) {
      const managedLines = managed.map((d) => {
        const tracked = trackedSet.get(d.name)!;
        const statusIcon = d.verified ? pc.green("✓") : pc.yellow("⏱");
        const dkimIcon =
          d.dkimStatus === "SUCCESS"
            ? pc.green("✓ SUCCESS")
            : pc.yellow(`⏱ ${d.dkimStatus}`);
        const label = tracked.isPrimary
          ? pc.dim("Primary")
          : pc.dim(PURPOSE_LABELS[tracked.purpose || "other"] || "General");
        return `  ${statusIcon} ${pc.bold(d.name.padEnd(30))} ${label.padEnd(24)} DKIM: ${dkimIcon}`;
      });

      clack.note(managedLines.join("\n"), "Managed by Wraps");
    }

    // Format unmanaged domains
    if (unmanaged.length > 0) {
      const unmanagedLines = unmanaged.map((d) => {
        const statusIcon = d.verified ? pc.green("✓") : pc.yellow("⏱");
        const dkimIcon =
          d.dkimStatus === "SUCCESS"
            ? pc.green("✓ SUCCESS")
            : pc.yellow(`⏱ ${d.dkimStatus}`);
        return `  ${statusIcon} ${pc.bold(d.name.padEnd(30))} ${pc.dim("".padEnd(16))} DKIM: ${dkimIcon}`;
      });

      clack.note(unmanagedLines.join("\n"), "Other SES domains");
    }

    clack.outro(
      pc.dim(
        `Run ${pc.cyan("wraps email domains verify --domain <domain>")} for details`
      )
    );

    // Track list domains success
    trackCommand("email:domains:list", {
      success: true,
      domain_count: sesDomains.length,
      managed_count: managed.length,
    });

    // Show promotional footer (once per session)
    getTelemetryClient().showFooterOnce();
  } catch (error) {
    progress.stop();
    trackCommand("email:domains:list", { success: false });
    throw error;
  }
}

/**
 * Get DKIM tokens for a domain
 */
export async function getDkim(options: { domain: string }): Promise<void> {
  clack.intro(pc.bold(`DKIM Tokens for ${options.domain}`));

  const progress = new DeploymentProgress();
  const region = await getAWSRegion();
  const sesClient = new SESv2Client({ region });

  try {
    const identity = await progress.execute(
      "Fetching DKIM configuration",
      async () => {
        const response = await sesClient.send(
          new GetEmailIdentityCommand({ EmailIdentity: options.domain })
        );
        return response;
      }
    );

    const dkimTokens = identity.DkimAttributes?.Tokens || [];
    const dkimStatus = identity.DkimAttributes?.Status || "PENDING";

    progress.stop();

    if (dkimTokens.length === 0) {
      clack.outro(pc.yellow("No DKIM tokens found for this domain"));
      return;
    }

    // Display DKIM status
    const statusLine = `${pc.bold("DKIM Status:")} ${
      dkimStatus === "SUCCESS"
        ? pc.green("✓ Verified")
        : pc.yellow(`⏱ ${dkimStatus}`)
    }`;
    clack.note(statusLine, "Status");

    // Display DKIM records
    console.log(`\n${pc.bold("DNS Records to add:")}\n`);
    for (const token of dkimTokens) {
      console.log(`${pc.cyan(`${token}._domainkey.${options.domain}`)}`);
      console.log(`  ${pc.dim("Type:")} CNAME`);
      console.log(`  ${pc.dim("Value:")} ${token}.dkim.amazonses.com\n`);
    }

    if (dkimStatus !== "SUCCESS") {
      console.log(
        `${pc.dim("After adding these records, run:")} ${pc.cyan(`wraps email domains verify --domain ${options.domain}`)}\n`
      );
    }

    // Track get-dkim success
    trackCommand("email:domains:get-dkim", {
      success: true,
      dkim_status: dkimStatus,
    });
  } catch (error) {
    progress.stop();
    trackCommand("email:domains:get-dkim", { success: false });
    if (isAWSNotFoundError(error)) {
      clack.log.error(`Domain ${options.domain} not found in SES`);
      console.log(
        `\nRun ${pc.cyan(`wraps email domains add ${options.domain}`)} to add this domain.\n`
      );
      process.exit(1);
      return; // Return after process.exit for testing
    }
    throw error;
  }
}

/**
 * Remove a domain from SES and metadata.
 * Guards against removing the primary (Pulumi-managed) domain without --force.
 */
export async function removeDomain(options: {
  domain: string;
  force?: boolean;
}): Promise<void> {
  clack.intro(pc.bold(`Remove domain ${options.domain} from SES`));

  const progress = new DeploymentProgress();
  const region = await getAWSRegion();
  const sesClient = new SESv2Client({ region });

  try {
    // Check if domain exists in SES
    await progress.execute("Checking if domain exists", async () => {
      await sesClient.send(
        new GetEmailIdentityCommand({ EmailIdentity: options.domain })
      );
    });

    // Check metadata to see if this is the primary domain
    let metadata: Awaited<ReturnType<typeof loadConnectionMetadata>> = null;
    try {
      const awsIdentity = await validateAWSCredentials();
      metadata = await loadConnectionMetadata(awsIdentity.accountId, region);
    } catch {
      // guardrail:allow-swallowed-error — metadata unavailable is non-fatal, proceed without guard
    }

    if (metadata) {
      const domainInfo = getDomainFromMetadata(metadata, options.domain);

      if (domainInfo?.isPrimary && !options.force) {
        progress.stop();
        clack.log.error(
          `${options.domain} is the primary domain (managed by Pulumi).`
        );
        console.log(
          `\nUse ${pc.cyan(`wraps email domains remove --domain ${options.domain} --force`)} to remove it,`
        );
        console.log(
          `or ${pc.cyan("wraps email destroy")} to remove all email infrastructure.\n`
        );
        process.exit(1);
        return;
      }
    }

    progress.stop();

    // Confirm deletion
    if (!options.force) {
      const shouldContinue = await clack.confirm({
        message: `Are you sure you want to remove ${pc.red(options.domain)} from SES?`,
        initialValue: false,
      });

      if (clack.isCancel(shouldContinue) || !shouldContinue) {
        clack.cancel("Operation cancelled");
        process.exit(0);
      }
    }

    // Delete the identity
    const { DeleteEmailIdentityCommand } = await import(
      "@aws-sdk/client-sesv2"
    );
    await progress.execute("Removing domain from SES", async () => {
      await sesClient.send(
        new DeleteEmailIdentityCommand({
          EmailIdentity: options.domain,
        })
      );
    });

    // Remove from metadata
    if (metadata) {
      removeDomainFromMetadata(metadata, options.domain);
      await saveConnectionMetadata(metadata);
    }

    progress.stop();
    clack.outro(pc.green(`✓ Domain ${options.domain} removed successfully`));

    // Track remove domain success
    trackCommand("email:domains:remove", {
      success: true,
    });
    trackFeature("domain_removed", {});
  } catch (error) {
    progress.stop();
    trackCommand("email:domains:remove", { success: false });
    if (isAWSNotFoundError(error)) {
      clack.log.error(`Domain ${options.domain} not found in SES`);
      process.exit(1);
      return;
    }
    throw error;
  }
}
