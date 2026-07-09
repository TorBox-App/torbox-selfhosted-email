import { WRAPS_CONFIGURATION_SET_NAME } from "./send";

export type ConfigSetIdentity = {
  identity: string;
  type: string;
  /** The SES configuration set attached to this identity, if discovery found one. */
  configSetName?: string;
};

export type ResolveConfigSetInput = {
  /** Domain part of the sender address, e.g. "acme.com". */
  fromDomain?: string;
  /**
   * The canonical config set stored on the AWS account during discovery
   * (`features.email.configSetName`) — whichever one the scan picked.
   */
  storedConfigSetName?: string | null;
  /** Verified identities on the account (`features.email.identities`). */
  identities?: ConfigSetIdentity[];
};

/**
 * Resolve which SES configuration set a send should use.
 *
 * Configuration sets are per-domain now (`wraps-email-<domain>`), but their
 * names are NOT safe to derive: a domain being verified does not prove its
 * per-domain set was ever provisioned, and a send that references a missing set
 * hard-fails at the SES request level (failing an entire broadcast chunk). So
 * this only ever returns a name we have positive evidence exists:
 *
 *   1. the sender domain's own identity config set (SES returned it during the
 *      discovery scan) — correct per-domain routing;
 *   2. else the stored canonical (discovery confirmed it too);
 *   3. else the legacy global set as a last resort.
 *
 * It never omits the set: omitting silently disables open/click/bounce tracking
 * and makes engagement-gated workflows take the "not engaged" branch.
 */
export function resolveConfigurationSetName(
  input: ResolveConfigSetInput
): string {
  const fromDomain = input.fromDomain?.trim().toLowerCase() || undefined;

  if (fromDomain) {
    const match = input.identities?.find(
      (i) =>
        i.type === "DOMAIN" &&
        i.identity.toLowerCase() === fromDomain &&
        i.configSetName
    );
    if (match?.configSetName) {
      return match.configSetName;
    }
  }

  const stored = input.storedConfigSetName?.trim();
  if (stored) {
    return stored;
  }

  return WRAPS_CONFIGURATION_SET_NAME;
}
