/**
 * Workflow Processor Utilities
 *
 * Pure utility functions and types used by workflow step handlers
 * and the main workflow processor orchestrator.
 */

import { toPlainText } from "@react-email/render";
import { renderTemplateStrict } from "@wraps/template-render";

import { log } from "../../lib/logger";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowBranch =
  | "yes"
  | "no"
  | "timeout"
  | "default"
  | "opened"
  | "clicked"
  | "bounced";

// ═══════════════════════════════════════════════════════════════════════════
// VARIABLE SUBSTITUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Substitute variables in text with values from a data object.
 *
 * Delegates to the canonical `@wraps/template-render` so workflow sends
 * render templates exactly the same way as the dashboard preview, the
 * test-send endpoint, and the subscription confirmation mailer. The
 * package handles `{{var}}`, `{{#if}}/{{else}}/{{/if}}`, and dot paths.
 *
 * Pass `escapeHtml: true` when the output is an HTML body — variable
 * values get entity-escaped so contact data can't inject markup. Leave it
 * off for non-HTML output (subjects, SMS bodies): those are plain text,
 * where escaping turns `Smith & Co` into `Smith &amp; Co` on a phone
 * screen or in a subject line.
 *
 * Uses the strict renderer: a compile or runtime failure THROWS instead of
 * returning the raw template, which fails the workflow step and blocks the
 * send. The swallowing renderer shipped literal `{{#if firstName}}` subject
 * lines to 22 recipients (Apr–Jun 2026) — a blocked send is recoverable via
 * retry; a delivered template-soup email is not.
 *
 * @exported for testing
 */
export function substituteVariables(
  text: string,
  data: Record<string, string>,
  options: { escapeHtml?: boolean } = {}
): string {
  try {
    return renderTemplateStrict(text, data, {
      noEscape: !options.escapeHtml,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.error("Workflow: template render failed, send blocked", {
      textPreview: text.slice(0, 200),
      dataKeys: Object.keys(data),
      reason,
    });
    throw new Error(
      `Template rendering failed: ${reason}. Send blocked so the recipient does not receive raw {{...}} template syntax — fix the template, then retry.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitize email subject line
 * - Removes newlines to prevent header injection
 * - Collapses whitespace
 * - Truncates to reasonable length (998 chars per RFC 2822)
 *
 * Deliberately does NOT entity-escape: a subject is a plain-text header,
 * not HTML. Escaping here delivered subjects like "Smith &amp; Co" to
 * real inboxes (double-escaped when the renderer had already escaped).
 * Escaping for display belongs in the UI layer.
 */
export function sanitizeEmailSubject(subject: string): string {
  return subject
    .replace(/[\r\n]+/g, " ") // Remove newlines (header injection prevention)
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim()
    .slice(0, 998); // RFC 2822 max line length
}

/**
 * Convert HTML to plain text for email fallback
 * Uses react-email's toPlainText for robust HTML-to-text conversion
 */
export function htmlToPlainText(html: string): string {
  return toPlainText(html);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHONE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate phone number is in E.164 format
 * E.164: +[country code][subscriber number] (e.g., +15551234567)
 */
export function isValidE164Phone(phone: string): boolean {
  // E.164 format: + followed by 10-15 digits
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  return e164Regex.test(phone);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONDITION EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

export function evaluateCondition(
  fieldValue: unknown,
  operator: string,
  compareValue: unknown
): boolean {
  const strFieldValue = String(fieldValue ?? "");
  const strCompareValue = String(compareValue ?? "");

  switch (operator) {
    case "equals":
      return strFieldValue === strCompareValue;
    case "not_equals":
      return strFieldValue !== strCompareValue;
    case "contains":
      return strFieldValue.includes(strCompareValue);
    case "not_contains":
      return !strFieldValue.includes(strCompareValue);
    case "starts_with":
      return strFieldValue.startsWith(strCompareValue);
    case "ends_with":
      return strFieldValue.endsWith(strCompareValue);
    case "greater_than":
      return Number(fieldValue) > Number(compareValue);
    case "less_than":
      return Number(fieldValue) < Number(compareValue);
    case "greater_than_or_equals":
      return Number(fieldValue) >= Number(compareValue);
    case "less_than_or_equals":
      return Number(fieldValue) <= Number(compareValue);
    case "is_true":
      return (
        fieldValue === true || strFieldValue === "true" || strFieldValue === "1"
      );
    case "is_false":
      return (
        fieldValue === false ||
        fieldValue === null ||
        fieldValue === undefined ||
        strFieldValue === "false" ||
        strFieldValue === "0" ||
        strFieldValue === ""
      );
    case "is_set":
      return (
        fieldValue !== null && fieldValue !== undefined && fieldValue !== ""
      );
    case "is_not_set":
      return (
        fieldValue === null || fieldValue === undefined || fieldValue === ""
      );
    default:
      log.warn("Unknown condition operator", { operator });
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT FIELD CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const FIRST_CLASS_CONTACT_FIELDS = new Set([
  "preferredChannel",
  "firstName",
  "lastName",
  "company",
  "jobTitle",
]);

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK / SSRF VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export const BLOCKED_IPV4_RANGES = [
  { prefix: "127.", label: "loopback" },
  { prefix: "10.", label: "private (10/8)" },
  { prefix: "169.254.", label: "link-local/IMDS" },
  { prefix: "0.", label: "unspecified" },
] as const;

/** @exported for testing */
export function isBlockedIp(ip: string): string | null {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) — extract the IPv4 and re-check
  if (ip.startsWith("::ffff:")) {
    const v4 = ip.slice(7);
    if (v4.includes(".")) {
      return isBlockedIp(v4);
    }
  }

  for (const range of BLOCKED_IPV4_RANGES) {
    if (ip.startsWith(range.prefix)) {
      return range.label;
    }
  }
  // 100.64.0.0/10 (Carrier-grade NAT / AWS VPC)
  if (ip.startsWith("100.")) {
    const second = Number.parseInt(ip.split(".")[1], 10);
    if (second >= 64 && second <= 127) {
      return "private (100.64/10 CGN)";
    }
  }
  // 172.16.0.0/12
  if (ip.startsWith("172.")) {
    const second = Number.parseInt(ip.split(".")[1], 10);
    if (second >= 16 && second <= 31) {
      return "private (172.16/12)";
    }
  }
  // 192.168.0.0/16
  if (ip.startsWith("192.168.")) {
    return "private (192.168/16)";
  }
  // IPv6
  if (ip === "::1" || ip === "::") {
    return "loopback";
  }
  if (ip.startsWith("fe80:")) {
    return "link-local";
  }
  if (ip.startsWith("fd") || ip.startsWith("fc")) {
    return "private (ULA)";
  }
  return null;
}

/** @exported for testing */
export async function validateWebhookUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Webhook URL must use http(s), got ${parsed.protocol}`);
  }

  const dns = await import("node:dns/promises");
  const { address } = await dns.lookup(parsed.hostname);
  const blockedReason = isBlockedIp(address);
  if (blockedReason) {
    throw new Error(
      `Webhook URL resolves to blocked address (${blockedReason}): ${parsed.hostname} -> ${address}`
    );
  }
}
