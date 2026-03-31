/**
 * SPF Check
 * Validates SPF records with lookup tree visualization
 */

import { SPF_LOOKUP_LIMIT } from "../constants.js";
import { findSpfRecord } from "../dns/index.js";
import type { SpfLookupNode, SpfResult } from "../types.js";

type SpfCheckContext = {
  visited: Set<string>;
  totalLookups: number;
  hasCircular: boolean;
  errors: string[];
};

/**
 * Check SPF record for a domain
 */
export async function checkSpf(domain: string): Promise<SpfResult> {
  // Find SPF records
  const spfRecords = await findSpfRecord(domain);

  // Initialize result
  const result: SpfResult = {
    exists: spfRecords.length > 0,
    record: spfRecords[0] || null,
    records: spfRecords,
    multipleRecords: spfRecords.length > 1,
    valid: false,
    syntaxErrors: [],
    warnings: [],
    lookupCount: 0,
    lookupLimit: SPF_LOOKUP_LIMIT,
    lookupTree: [],
    allMechanism: null,
    includes: [],
    hasPtr: false,
    hasDuplicates: false,
    hasCircularInclude: false,
    recordLength: spfRecords[0]?.length || 0,
    usesMacros: false,
    macros: [],
  };

  // Multiple SPF records is a critical error
  if (spfRecords.length > 1) {
    result.syntaxErrors.push(
      `Multiple SPF records found (${spfRecords.length}). RFC 7208 allows only one.`
    );
    return result;
  }

  // No SPF record
  if (!(result.exists && result.record)) {
    return result;
  }

  // Parse and validate the SPF record
  try {
    await parseAndValidateSpf(domain, result.record, result);
  } catch (error: any) {
    result.syntaxErrors.push(error.message);
  }

  return result;
}

/**
 * Parse and validate an SPF record
 */
async function parseAndValidateSpf(
  domain: string,
  record: string,
  result: SpfResult
): Promise<void> {
  // Check for valid SPF prefix
  if (!record.startsWith("v=spf1")) {
    result.syntaxErrors.push('SPF record must start with "v=spf1"');
    return;
  }

  // Remove the v=spf1 prefix
  const mechanisms = record.slice(6).trim().split(/\s+/).filter(Boolean);

  // Context for recursive lookups
  const context: SpfCheckContext = {
    visited: new Set([domain]),
    totalLookups: 0,
    hasCircular: false,
    errors: [],
  };

  // Process mechanisms
  const includes: string[] = [];
  let allMechanism: SpfResult["allMechanism"] = null;
  let hasPtr = false;

  for (const mechanism of mechanisms) {
    // Parse mechanism
    const parsed = parseMechanism(mechanism);

    if (!parsed) {
      // Check for macros
      if (mechanism.includes("%{")) {
        result.usesMacros = true;
        result.macros.push(mechanism);
        result.warnings.push(
          `SPF uses macro "${mechanism}" - cannot fully validate without sending IP`
        );
      } else if (mechanism !== "") {
        result.syntaxErrors.push(`Invalid mechanism: ${mechanism}`);
      }
      continue;
    }

    // Handle each mechanism type
    switch (parsed.type) {
      case "all":
        allMechanism = `${parsed.qualifier}all` as SpfResult["allMechanism"];
        break;

      case "include":
        if (parsed.domain) {
          includes.push(parsed.domain);
          // Recursively check include
          const includeNode = await checkSpfInclude(
            parsed.domain,
            context,
            mechanism
          );
          result.lookupTree.push(includeNode);
        }
        break;

      case "redirect":
        if (parsed.domain) {
          // redirect= is like include but replaces the entire SPF
          const redirectNode = await checkSpfInclude(
            parsed.domain,
            context,
            mechanism
          );
          result.lookupTree.push(redirectNode);
        }
        break;

      case "a":
        context.totalLookups++;
        if (parsed.domain) {
          const aNode: SpfLookupNode = {
            mechanism,
            type: "a",
            domain: parsed.domain,
            lookups: 1,
            children: [],
            error: null,
          };
          result.lookupTree.push(aNode);
        }
        break;

      case "mx":
        context.totalLookups++;
        if (parsed.domain) {
          const mxNode: SpfLookupNode = {
            mechanism,
            type: "mx",
            domain: parsed.domain,
            lookups: 1,
            children: [],
            error: null,
          };
          result.lookupTree.push(mxNode);
        }
        break;

      case "ptr":
        hasPtr = true;
        context.totalLookups++;
        result.warnings.push("SPF uses deprecated 'ptr' mechanism (RFC 7208)");
        break;

      case "exists":
        context.totalLookups++;
        break;

      case "ip4":
      case "ip6":
        // IP mechanisms don't cause lookups
        break;

      default:
        result.warnings.push(`Unknown mechanism type: ${parsed.type}`);
    }
  }

  // Check for duplicates
  const seenIncludes = new Set<string>();
  for (const inc of includes) {
    if (seenIncludes.has(inc)) {
      result.hasDuplicates = true;
      result.warnings.push(`Duplicate include: ${inc}`);
    }
    seenIncludes.add(inc);
  }

  // Update result
  result.includes = includes;
  result.allMechanism = allMechanism;
  result.hasPtr = hasPtr;
  result.lookupCount = context.totalLookups;
  result.hasCircularInclude = context.hasCircular;
  result.valid =
    result.syntaxErrors.length === 0 &&
    !result.multipleRecords &&
    !result.hasCircularInclude;

  // Warnings
  if (context.totalLookups > SPF_LOOKUP_LIMIT) {
    result.warnings.push(
      `SPF exceeds 10 DNS lookup limit (${context.totalLookups} lookups)`
    );
  } else if (context.totalLookups === SPF_LOOKUP_LIMIT) {
    result.warnings.push(
      "SPF at lookup limit (10). Adding more includes will fail."
    );
  }

  if (allMechanism === "+all") {
    result.syntaxErrors.push("SPF ends with +all which allows anyone to send");
    result.valid = false;
  } else if (allMechanism === "?all") {
    result.warnings.push(
      "SPF uses ?all (neutral) - consider using -all or ~all"
    );
  } else if (!allMechanism) {
    result.warnings.push(
      "SPF record has no 'all' mechanism - defaults to neutral"
    );
  }

  if (context.errors.length > 0) {
    result.warnings.push(...context.errors);
  }
}

/**
 * Recursively check SPF include
 */
async function checkSpfInclude(
  domain: string,
  context: SpfCheckContext,
  mechanism: string
): Promise<SpfLookupNode> {
  const node: SpfLookupNode = {
    mechanism,
    type: mechanism.startsWith("redirect=") ? "redirect" : "include",
    domain,
    lookups: 1,
    children: [],
    error: null,
  };

  // Check for circular reference
  if (context.visited.has(domain)) {
    context.hasCircular = true;
    node.error = `Circular include detected: ${domain}`;
    return node;
  }

  context.visited.add(domain);
  context.totalLookups++;

  try {
    // Fetch the included SPF record
    const spfRecords = await findSpfRecord(domain);

    if (spfRecords.length === 0) {
      node.error = `No SPF record found for ${domain}`;
      return node;
    }

    if (spfRecords.length > 1) {
      node.error = `Multiple SPF records found for ${domain}`;
      return node;
    }

    const record = spfRecords[0]!;
    if (!record.startsWith("v=spf1")) {
      node.error = `Invalid SPF record for ${domain}`;
      return node;
    }

    // Parse mechanisms from the included record
    const mechanisms = record.slice(6).trim().split(/\s+/).filter(Boolean);

    for (const mech of mechanisms) {
      const parsed = parseMechanism(mech);
      if (!parsed) {
        continue;
      }

      switch (parsed.type) {
        case "include":
        case "redirect":
          if (parsed.domain) {
            const childNode = await checkSpfInclude(
              parsed.domain,
              context,
              mech
            );
            node.children.push(childNode);
            node.lookups += childNode.lookups;
          }
          break;

        case "a":
        case "mx":
        case "ptr":
        case "exists":
          context.totalLookups++;
          node.lookups++;
          break;
      }
    }
  } catch (error: any) {
    node.error = `Failed to resolve ${domain}: ${error.message}`;
  }

  return node;
}

type ParsedMechanism = {
  qualifier: "+" | "-" | "~" | "?";
  type: string;
  domain?: string;
  prefix?: string;
};

/**
 * Parse an SPF mechanism
 */
function parseMechanism(mechanism: string): ParsedMechanism | null {
  if (!mechanism) {
    return null;
  }

  // Extract qualifier
  let qualifier: ParsedMechanism["qualifier"] = "+";
  let mech = mechanism;

  if (/^[+\-~?]/.test(mech)) {
    qualifier = mech.charAt(0) as ParsedMechanism["qualifier"];
    mech = mech.slice(1);
  }

  // Parse mechanism type and value
  // Note: redirect and exp use '=' instead of ':' as delimiter
  const match = mech.match(
    /^(all|include|a|mx|ptr|ip4|ip6|exists|redirect|exp)(?:[:=]([^\s/]+))?(?:\/(\d+))?$/i
  );

  if (!match) {
    return null;
  }

  const type = match[1];
  const value = match[2];
  const prefix = match[3];

  if (!type) {
    return null;
  }

  return {
    qualifier,
    type: type.toLowerCase(),
    domain: value,
    prefix,
  };
}

/**
 * Format SPF lookup tree for display
 */
export function formatSpfLookupTree(
  nodes: SpfLookupNode[],
  indent = ""
): string {
  const lines: string[] = [];

  for (const [i, node] of nodes.entries()) {
    const isLast = i === nodes.length - 1;
    const prefix = isLast ? "└── " : "├── ";
    const childIndent = isLast ? "    " : "│   ";

    let line = `${indent}${prefix}${node.mechanism}`;
    if (node.lookups > 1) {
      line += ` (${node.lookups} lookups)`;
    } else {
      line += " (1)";
    }
    if (node.error) {
      line += ` ⚠ ${node.error}`;
    }
    lines.push(line);

    if (node.children.length > 0) {
      lines.push(formatSpfLookupTree(node.children, indent + childIndent));
    }
  }

  return lines.join("\n");
}
