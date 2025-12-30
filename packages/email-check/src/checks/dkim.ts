/**
 * DKIM Check
 * Validates DKIM records with selector discovery
 */

import {
  DEFAULT_DKIM_SELECTORS,
  DKIM_BATCH_SIZE,
  QUICK_DKIM_SELECTORS,
} from "../constants.js";
import { batchDnsQuery, findDkimRecord } from "../dns/index.js";
import type { DkimResult, DkimSelector } from "../types.js";

export interface DkimCheckOptions {
  /** Use quick mode (fewer selectors) */
  quick?: boolean;
  /** Specific selector to check */
  selector?: string;
  /** Custom list of selectors */
  selectors?: string[];
  /** Show all results (don't stop early) */
  verbose?: boolean;
  /** Detected email provider from SPF (for better messaging) */
  detectedProvider?: string;
}

/**
 * Check DKIM records for a domain
 */
export async function checkDkim(
  domain: string,
  options: DkimCheckOptions = {}
): Promise<DkimResult> {
  const {
    quick = false,
    selector,
    selectors: customSelectors,
    verbose = false,
    detectedProvider,
  } = options;

  // Determine which selectors to check
  let selectorsToCheck: string[];
  if (selector) {
    selectorsToCheck = [selector];
  } else if (customSelectors && customSelectors.length > 0) {
    selectorsToCheck = customSelectors;
  } else if (quick) {
    selectorsToCheck = [...QUICK_DKIM_SELECTORS];
  } else {
    selectorsToCheck = [...DEFAULT_DKIM_SELECTORS];
  }

  const result: DkimResult = {
    found: false,
    selectors: [],
    selectorsChecked: 0,
    earlyExit: false,
    warnings: [],
  };

  // Check selectors in batches
  let foundValid = false;

  for (let i = 0; i < selectorsToCheck.length; i += DKIM_BATCH_SIZE) {
    // If we found a valid selector and not in verbose mode, stop
    if (foundValid && !verbose) {
      result.earlyExit = true;
      break;
    }

    const batch = selectorsToCheck.slice(i, i + DKIM_BATCH_SIZE);
    const batchResults = await batchDnsQuery(
      batch,
      async (sel) => checkDkimSelector(domain, sel),
      DKIM_BATCH_SIZE
    );

    for (const selectorResult of batchResults) {
      result.selectorsChecked++;

      if (selectorResult.exists) {
        result.selectors.push(selectorResult);
        result.found = true;

        if (selectorResult.valid && !selectorResult.revoked) {
          foundValid = true;
        }
      }
    }
  }

  // Sort selectors by validity
  result.selectors.sort((a, b) => {
    // Valid, non-revoked first
    const aScore = (a.valid ? 2 : 0) + (a.revoked ? 0 : 1);
    const bScore = (b.valid ? 2 : 0) + (b.revoked ? 0 : 1);
    return bScore - aScore;
  });

  // Add helpful warnings for providers with random/custom selectors
  if (!result.found && detectedProvider) {
    const randomSelectorProviders: Record<string, string> = {
      ses: "AWS SES uses random DKIM selectors. Check your SES console or use --dkimSelector with your actual selector.",
      amazonses: "AWS SES uses random DKIM selectors. Check your SES console or use --dkimSelector with your actual selector.",
      sendgrid: "SendGrid may use custom selectors. Check your SendGrid dashboard or use --dkimSelector.",
      mailgun: "Mailgun may use custom selectors. Check your Mailgun dashboard or use --dkimSelector.",
    };

    const providerLower = detectedProvider.toLowerCase();
    for (const [key, message] of Object.entries(randomSelectorProviders)) {
      if (providerLower.includes(key)) {
        result.warnings.push(message);
        break;
      }
    }
  }

  return result;
}

/**
 * Check a single DKIM selector
 */
async function checkDkimSelector(
  domain: string,
  selector: string
): Promise<DkimSelector> {
  const result: DkimSelector = {
    selector,
    exists: false,
    record: null,
    valid: false,
    keyType: null,
    keyBits: null,
    publicKey: null,
    testMode: false,
    revoked: false,
    expired: false,
    hashAlgorithms: [],
    serviceTypes: [],
    flags: [],
    errors: [],
    warnings: [],
  };

  try {
    const record = await findDkimRecord(domain, selector);

    if (!record) {
      return result;
    }

    result.exists = true;
    result.record = record;

    // Parse DKIM record
    parseDkimRecord(record, result);
  } catch (error: any) {
    result.errors.push(error.message);
  }

  return result;
}

/**
 * Parse a DKIM TXT record
 */
function parseDkimRecord(record: string, result: DkimSelector): void {
  // Parse tags
  const tags = parseDkimTags(record);

  // Check version
  const version = tags.get("v");
  if (version && version !== "DKIM1") {
    result.errors.push(`Invalid DKIM version: ${version}`);
  }

  // Get key type
  const keyType = tags.get("k") || "rsa";
  if (keyType === "rsa") {
    result.keyType = "rsa";
  } else if (keyType === "ed25519") {
    result.keyType = "ed25519";
  } else {
    result.keyType = "unknown";
    result.warnings.push(`Unknown key type: ${keyType}`);
  }

  // Get public key
  const publicKey = tags.get("p");
  if (publicKey === undefined) {
    result.errors.push("Missing public key (p=)");
    return;
  }

  if (publicKey === "") {
    // Empty p= means key is revoked
    result.revoked = true;
    result.warnings.push("DKIM key is revoked (empty p= tag)");
    return;
  }

  result.publicKey = publicKey;

  // Calculate RSA key size
  if (result.keyType === "rsa") {
    try {
      // Base64 decode and estimate key size
      const keyData = Buffer.from(publicKey, "base64");
      // RSA public key size estimation (simplified)
      // A 2048-bit key is roughly 270-300 bytes in DER format
      const estimatedBits = keyData.length * 8;
      // Adjust for DER overhead (roughly 30-40 bytes)
      result.keyBits = Math.round((estimatedBits - 256) * 0.95);

      // Clamp to reasonable values
      if (result.keyBits < 512) result.keyBits = 512;
      if (result.keyBits > 4096) result.keyBits = 4096;

      // Round to common key sizes
      if (result.keyBits <= 768) result.keyBits = 512;
      else if (result.keyBits <= 1200) result.keyBits = 1024;
      else if (result.keyBits <= 2500) result.keyBits = 2048;
      else if (result.keyBits <= 3500) result.keyBits = 3072;
      else result.keyBits = 4096;

      if (result.keyBits < 1024) {
        result.errors.push(`RSA key too weak: ${result.keyBits} bits`);
      } else if (result.keyBits < 2048) {
        result.warnings.push(
          `RSA key should be 2048+ bits (currently ${result.keyBits})`
        );
      }
    } catch {
      result.warnings.push("Could not determine RSA key size");
    }
  }

  // Check hash algorithms
  const hashAlg = tags.get("h");
  if (hashAlg) {
    result.hashAlgorithms = hashAlg.split(":").map((h) => h.trim());
    if (
      result.hashAlgorithms.includes("sha1") &&
      !result.hashAlgorithms.includes("sha256")
    ) {
      result.warnings.push("Only sha1 allowed - sha256 recommended");
    }
  } else {
    result.hashAlgorithms = ["sha1", "sha256"]; // Default
  }

  // Check service types
  const serviceType = tags.get("s");
  if (serviceType) {
    result.serviceTypes = serviceType.split(":").map((s) => s.trim());
    if (
      !(
        result.serviceTypes.includes("*") ||
        result.serviceTypes.includes("email")
      )
    ) {
      result.warnings.push(
        `Service type restricts to: ${result.serviceTypes.join(", ")}`
      );
    }
  } else {
    result.serviceTypes = ["*"]; // Default
  }

  // Check flags
  const flagsTag = tags.get("t");
  if (flagsTag) {
    result.flags = flagsTag.split(":").map((f) => f.trim());
    if (result.flags.includes("y")) {
      result.testMode = true;
      result.warnings.push("DKIM in testing mode (t=y)");
    }
  }

  // Check notes (informational)
  const notes = tags.get("n");
  if (notes) {
    result.warnings.push(`DKIM note: ${notes}`);
  }

  // Mark as valid if no errors
  result.valid = result.errors.length === 0 && !result.revoked;
}

/**
 * Parse DKIM tags from a record
 */
function parseDkimTags(record: string): Map<string, string> {
  const tags = new Map<string, string>();

  // Split by semicolon, handling whitespace
  const parts = record
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;

    const key = part.slice(0, eqIndex).trim().toLowerCase();
    const value = part.slice(eqIndex + 1).trim();
    tags.set(key, value);
  }

  return tags;
}

/**
 * Format DKIM results for display
 */
export function formatDkimResults(result: DkimResult): string {
  if (!result.found) {
    return `No DKIM selectors found (checked ${result.selectorsChecked} selectors)`;
  }

  const validSelectors = result.selectors.filter((s) => s.valid && !s.revoked);

  if (validSelectors.length === 0) {
    return `Found ${result.selectors.length} DKIM records but none are valid`;
  }

  const lines = [`Found ${validSelectors.length} valid selector(s):`];

  for (const sel of validSelectors) {
    let desc = `• ${sel.selector}`;
    if (sel.keyType === "rsa" && sel.keyBits) {
      desc += ` (${sel.keyBits}-bit RSA)`;
    } else if (sel.keyType === "ed25519") {
      desc += " (Ed25519)";
    }
    if (sel.testMode) {
      desc += " [testing mode]";
    }
    lines.push(desc);
  }

  if (result.earlyExit) {
    lines.push(
      `\n(stopped after finding valid selector, ${result.selectorsChecked} checked)`
    );
  }

  return lines.join("\n");
}
