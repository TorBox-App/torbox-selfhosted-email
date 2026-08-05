/**
 * BIMI Check
 * Validates BIMI (Brand Indicators for Message Identification) records,
 * the hosted SVG logo, and VMC/CMC reachability.
 *
 * Spec sources (bimigroup.org, 2026-08-04): record lives at
 * `default._bimi.<domain>`; `l=` is the SVG logo URL (HTTPS only), `a=` is an
 * optional VMC/CMC PEM URL. The SVG must be SVG Tiny P/S: baseProfile="tiny-ps",
 * version="1.2", a <title>, no scripts/animation/external refs/raster images,
 * no x=/y= on the root <svg>, and should not exceed 32KB. Full X.509
 * certificate verification is not implemented here (see vmcValid below) —
 * the VMC is only checked for HTTPS reachability.
 */

import { DEFAULT_TIMEOUT } from "../constants.js";
import { findBimiRecord } from "../dns/index.js";
import type { BimiResult, DmarcResult } from "../types.js";

const MAX_SVG_BYTES = 32 * 1024; // bimigroup.org: "should not exceed 32 kilobytes"

/**
 * Check BIMI record, logo, and VMC for a domain
 */
export async function checkBimi(
  domain: string,
  dmarcPolicy: DmarcResult["policy"]
): Promise<BimiResult> {
  const result: BimiResult = {
    configured: false,
    record: null,
    logoUrl: null,
    vmcUrl: null,
    logoAccessible: false,
    logoValid: false,
    vmcAccessible: false,
    vmcValid: false,
    dmarcCompatible: dmarcPolicy === "quarantine" || dmarcPolicy === "reject",
    errors: [],
    warnings: [],
  };

  try {
    const record = await findBimiRecord(domain);

    if (!record) {
      return result;
    }

    result.record = record;

    const tags = parseBimiTags(record);

    const version = tags.get("v");
    if (version !== "BIMI1") {
      result.errors.push(`Invalid BIMI version: ${version || "missing"}`);
      return result;
    }

    const logoUrl = tags.get("l");
    if (!logoUrl) {
      result.errors.push("Missing required logo location (l=)");
      return result;
    }

    result.configured = true;
    result.logoUrl = logoUrl;

    const vmcUrl = tags.get("a");
    result.vmcUrl = vmcUrl ? vmcUrl : null;

    await checkLogo(logoUrl, result);

    if (result.vmcUrl) {
      await checkVmc(result.vmcUrl, result);
    }
  } catch (error: any) {
    result.errors.push(error.message);
  }

  return result;
}

/**
 * Parse BIMI tags from a TXT record (same tag-parsing shape as DMARC)
 */
function parseBimiTags(record: string): Map<string, string> {
  const tags = new Map<string, string>();

  const parts = record
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = part.slice(0, eqIndex).trim().toLowerCase();
    const value = part.slice(eqIndex + 1).trim();
    tags.set(key, value);
  }

  return tags;
}

/**
 * Fetch and validate the SVG logo
 */
async function checkLogo(logoUrl: string, result: BimiResult): Promise<void> {
  if (!logoUrl.startsWith("https:")) {
    result.errors.push(
      `Logo URL must use HTTPS (found ${logoUrl.split(":")[0]}:)`
    );
    return;
  }

  try {
    const response = await fetch(logoUrl, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      result.errors.push(
        `Logo URL returned HTTP ${response.status.toString()}`
      );
      return;
    }

    result.logoAccessible = true;

    const svg = await response.text();
    const validation = validateBimiSvg(svg);
    result.logoValid = validation.valid;
    for (const error of validation.errors) {
      result.errors.push(error);
    }
  } catch (error: any) {
    result.errors.push(`Failed to fetch logo: ${error.message}`);
  }
}

/**
 * Probe the VMC/CMC URL for reachability only.
 * Full X.509 certificate verification is not implemented — vmcValid stays
 * false until it is (see scoring.ts, which caps the BIMI bonus at +1 until
 * vmcValid can be true).
 */
async function checkVmc(vmcUrl: string, result: BimiResult): Promise<void> {
  if (!vmcUrl.startsWith("https:")) {
    result.errors.push(
      `VMC URL must use HTTPS (found ${vmcUrl.split(":")[0]}:)`
    );
    return;
  }

  try {
    const response = await fetch(vmcUrl, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    result.vmcAccessible = response.ok;
    if (!response.ok) {
      result.errors.push(`VMC URL returned HTTP ${response.status.toString()}`);
    }
  } catch (error: any) {
    result.errors.push(`Failed to fetch VMC: ${error.message}`);
  }

  result.warnings.push(
    "VMC/CMC certificate verification is not implemented — reachability was checked, not validity."
  );
}

/**
 * Validate an SVG against the BIMI SVG Tiny P/S (Portable/Secure) profile.
 * String/regex based — this package has no XML parser dependency.
 */
function validateBimiSvg(svg: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const byteLength = Buffer.byteLength(svg, "utf8");
  if (byteLength > MAX_SVG_BYTES) {
    errors.push(
      `SVG is ${byteLength.toString()} bytes, exceeding the 32KB BIMI limit`
    );
  }

  const svgTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) {
    errors.push("No <svg> root element found");
    return { valid: false, errors };
  }
  const svgTag = svgTagMatch[0];

  if (!/baseProfile\s*=\s*["']tiny-ps["']/i.test(svgTag)) {
    errors.push('Missing or invalid baseProfile (must be "tiny-ps")');
  }

  if (!/version\s*=\s*["']1\.2["']/i.test(svgTag)) {
    errors.push('Missing or invalid version (must be "1.2")');
  }

  if (
    /\bx\s*=\s*["'][^"']*["']/i.test(svgTag) ||
    /\by\s*=\s*["'][^"']*["']/i.test(svgTag)
  ) {
    errors.push("Root <svg> element must not have x= or y= attributes");
  }

  if (!/<title\b[^>]*>/i.test(svg)) {
    errors.push("Missing required <title> element");
  }

  if (/<script\b/i.test(svg)) {
    errors.push("SVG must not contain <script> elements");
  }

  if (/<foreignObject\b/i.test(svg)) {
    errors.push("SVG must not contain <foreignObject> elements");
  }

  if (/<image\b/i.test(svg)) {
    errors.push("SVG must not contain embedded raster images (<image>)");
  }

  if (/<animate\b|<animateTransform\b|<animateMotion\b/i.test(svg)) {
    errors.push("SVG must not contain animation elements");
  }

  const hrefMatches = svg.matchAll(
    /\b(?:xlink:href|href)\s*=\s*["']([^"']*)["']/gi
  );
  for (const match of hrefMatches) {
    const value = match[1] ?? "";
    if (value && !value.startsWith("#") && !value.startsWith("data:")) {
      errors.push(`SVG must not contain external references (found ${value})`);
    }
  }

  const viewBoxMatch = svgTag.match(/viewBox\s*=\s*["']([^"']*)["']/i);
  const viewBoxValue = viewBoxMatch?.[1];
  if (viewBoxValue) {
    const parts = viewBoxValue.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      const [, , width, height] = parts;
      if (width !== height) {
        errors.push(`SVG viewBox must be square (got ${width}x${height})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
