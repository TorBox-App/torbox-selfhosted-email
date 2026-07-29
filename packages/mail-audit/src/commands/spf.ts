import { checkSpf, formatSpfLookupTree } from "@wraps.dev/email-check";
import pc from "picocolors";
import type { ParsedArgs } from "../parse-args.js";
import { createSpinner, printJson } from "../utils.js";

// Provider detection map — mechanism substring → display name
const PROVIDER_MAP: Record<string, string> = {
  "_spf.google.com": "Google Workspace",
  "spf.protection.outlook.com": "Microsoft 365",
  "amazonses.com": "AWS SES",
  "sendgrid.net": "SendGrid",
  "spf.mtasv.net": "Postmark",
  "mailgun.org": "Mailgun",
  "emsd1.com": "ActiveCampaign",
  "spf.constantcontact.com": "Constant Contact",
  "convertkit.com": "ConvertKit",
  "customeriomail.com": "Customer.io",
  "send.klaviyo.com": "Klaviyo",
  "_spf.salesforce.com": "Salesforce",
  "mail.zendesk.com": "Zendesk",
  "email.freshdesk.com": "Freshdesk",
  "zoho.com": "Zoho",
  "spf1.stripe.com": "Stripe",
};

function detectProviders(record: string): string[] {
  const providers: string[] = [];
  const lower = record.toLowerCase();
  for (const [mechanism, name] of Object.entries(PROVIDER_MAP)) {
    if (lower.includes(mechanism.toLowerCase())) {
      providers.push(name);
    }
  }
  return providers;
}

export async function runSpfCheck(
  domain: string,
  flags: ParsedArgs["flags"]
): Promise<void> {
  const spinner = flags.json ? null : createSpinner();
  spinner?.start(`Checking SPF for ${pc.cyan(domain)}...`);

  try {
    const result = await checkSpf(domain);
    spinner?.stop();

    if (flags.json) {
      printJson({ domain, spf: result });
      process.exit(0);
      return;
    }

    console.log();
    console.log(pc.bold(`SPF Analysis for ${pc.cyan(domain)}`));
    console.log();

    if (!result.exists) {
      console.log(pc.red("  No SPF record found"));
      console.log();
      console.log(pc.dim("  Add a TXT record to your DNS with an SPF policy."));
      console.log(pc.dim("  Example: v=spf1 include:_spf.google.com -all"));
      console.log();
      console.log(
        pc.yellow("  Build your SPF record:") +
          ` ${pc.cyan(`wraps.dev/tools/spf-builder?domain=${domain}&utm_source=mail-audit&utm_medium=cli`)}`
      );
      console.log();
      process.exit(1);
      return;
    }

    // Multiple records warning
    if (result.multipleRecords) {
      console.log(
        pc.red(
          `  ⚠ ${result.records.length} SPF records found — RFC 7208 allows only one!`
        )
      );
      console.log();
      for (const rec of result.records) {
        console.log(`  ${pc.dim("→")} ${rec}`);
      }
      console.log();
      console.log(
        pc.yellow(
          "  Merge these into a single SPF record to fix this violation."
        )
      );
      console.log();
    }

    // Record
    console.log(`  ${pc.dim("Record:")}  ${result.record}`);
    console.log();

    // Lookup count with visual bar
    const used = result.lookupCount;
    const max = 10;
    const barWidth = 30;
    const filledWidth = Math.round((used / max) * barWidth);
    const filled = "█".repeat(filledWidth);
    const empty = "░".repeat(barWidth - filledWidth);

    const lookupColor = used <= 7 ? pc.green : used <= 9 ? pc.yellow : pc.red;

    console.log(
      `  ${pc.dim("Lookups:")} ${lookupColor(`${used}/${max}`)} ${lookupColor(filled)}${pc.dim(empty)}`
    );
    console.log();

    // Lookup tree
    if (result.lookupTree.length > 0) {
      console.log(`  ${pc.dim("Lookup Tree:")}`);
      console.log();
      const tree = formatSpfLookupTree(result.lookupTree);
      for (const line of tree.split("\n")) {
        console.log(`    ${line}`);
      }
      console.log();
    }

    // Provider detection
    if (result.record) {
      const providers = detectProviders(result.record);
      if (providers.length > 0) {
        console.log(`  ${pc.dim("Providers:")} ${providers.join(", ")}`);
        console.log();
      }
    }

    // All mechanism analysis
    if (result.allMechanism) {
      const allLabel =
        result.allMechanism === "-all"
          ? pc.green("Strict (-all) — unauthorized servers rejected")
          : result.allMechanism === "~all"
            ? pc.yellow(
                "Softfail (~all) — unauthorized servers tagged but accepted"
              )
            : result.allMechanism === "+all"
              ? pc.red("OPEN (+all) — anyone can send as your domain!")
              : pc.dim(`${result.allMechanism}`);
      console.log(`  ${pc.dim("Policy:")}   ${allLabel}`);
      console.log();
    }

    // Warnings
    if (result.warnings.length > 0) {
      console.log(`  ${pc.yellow("Warnings:")}`);
      for (const w of result.warnings) {
        console.log(`    ${pc.yellow("⚠")} ${w}`);
      }
      console.log();
    }

    // Issues
    if (result.syntaxErrors.length > 0) {
      console.log(`  ${pc.red("Errors:")}`);
      for (const e of result.syntaxErrors) {
        console.log(`    ${pc.red("✗")} ${e}`);
      }
      console.log();
    }

    // CTA when there are issues
    const hasIssues =
      result.warnings.length > 0 ||
      result.syntaxErrors.length > 0 ||
      result.lookupCount > 7 ||
      result.allMechanism !== "-all";

    if (hasIssues) {
      console.log(pc.dim("─".repeat(60)));
      console.log();
      console.log(
        pc.yellow("  Fix your SPF record:") +
          ` ${pc.cyan(`wraps.dev/tools/spf-builder?domain=${domain}&utm_source=mail-audit&utm_medium=cli`)}`
      );
      console.log();
    }

    process.exit(0);
  } catch (error) {
    spinner?.stop();
    const msg = error instanceof Error ? error.message : String(error);
    if (flags.json) {
      printJson({ error: msg });
    } else {
      console.log(pc.red(`Error: ${msg}`));
    }
    process.exit(4);
  }
}
