/**
 * Region resolution for post-deploy commands.
 *
 * Post-deploy commands (upgrade, restore, destroy, status, doctor, platform
 * connect, templates push) historically silent-defaulted to us-east-1 when the
 * user ran them in a fresh shell with a real deployment elsewhere. This helper
 * closes that hole by resolving region from — in order — the explicit option,
 * env vars, and saved connection metadata, prompting or erroring when the
 * saved metadata is ambiguous.
 *
 * Intentional silent behaviors:
 * 1. Exactly one saved connection → auto-pick it (happy path for single-region
 *    users; cannot hit the wrong region).
 * 2. No saved metadata AND no env region → fall back to `getAWSRegion()`,
 *    which returns the global default from constants. This preserves first-
 *    run behavior for users who have never run `init`. Callers that need
 *    strictness should pass `optionRegion` or require `AWS_REGION` upstream.
 */

import * as clack from "@clack/prompts";
import type { ServiceType } from "../../types/index.js";
import { getAWSRegion } from "./aws.js";
import { errors, WrapsError } from "./errors.js";
import { isJsonMode } from "./json-output.js";
import {
  findConnectionsForAccount,
  findConnectionsWithService,
} from "./metadata.js";
import { isInteractive } from "./prompts.js";

export type ResolveRegionOptions = {
  /** The account ID under which we look up saved metadata. */
  accountId: string;
  /** Explicit --region flag value, if any. Wins over env and metadata. */
  optionRegion?: string;
  /**
   * When set, only consider connections that have this service configured.
   * Omit to consider every connection for the account.
   */
  service?: ServiceType;
  /**
   * Promptable label — "email deployment", "SMS deployment", "connection",
   * whatever reads best in the interactive select. Defaults to "deployment".
   */
  label?: string;
};

/**
 * Resolve region with explicit precedence: option → env → saved metadata.
 *
 * - One saved connection → auto-picks it.
 * - Multiple saved connections, interactive TTY → prompts.
 * - Multiple saved connections, non-interactive or JSON mode → throws
 *   REGION_REQUIRED with the saved regions listed.
 * - Zero saved connections AND no env → falls back to `getAWSRegion()` (see
 *   file-level docblock for rationale).
 */
export async function resolveRegionForCommand(
  opts: ResolveRegionOptions
): Promise<string> {
  const { accountId, optionRegion, service, label = "deployment" } = opts;

  // 1. Explicit flag wins.
  if (optionRegion) {
    return optionRegion;
  }

  // 2. Env vars next (matches AWS SDK v3 chain).
  const envRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (envRegion) {
    return envRegion;
  }

  // 3. Saved connection metadata.
  const connections =
    (service
      ? await findConnectionsWithService(accountId, service)
      : await findConnectionsForAccount(accountId)) ?? [];

  if (connections.length === 1) {
    return connections[0].region;
  }

  const savedRegions = connections.map((c) => c.region);

  if (connections.length === 0) {
    // No saved metadata AND no env — preserve pre-enforcement behavior so
    // first-run users without a prior init don't hit a hard error. The
    // getAWSRegion() default is us-east-1; callers that want strictness
    // should pass optionRegion or set AWS_REGION.
    return getAWSRegion();
  }

  // Multiple connections — prompt if interactive, error otherwise.
  if (!isInteractive() || isJsonMode()) {
    throw errors.regionRequired(accountId, savedRegions);
  }

  const selected = await clack.select({
    message: `Multiple ${label}s found. Which region?`,
    options: connections.map((conn) => ({
      value: conn.region,
      label: conn.region,
    })),
  });

  if (clack.isCancel(selected)) {
    throw new WrapsError(
      "Operation cancelled",
      "OPERATION_CANCELLED",
      `Pass --region to skip the prompt. Saved regions: ${savedRegions.join(", ")}`
    );
  }

  return selected as string;
}
