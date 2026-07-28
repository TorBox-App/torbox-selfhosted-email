import { getAppBaseUrl } from "../shared/config.js";
import { loadConnectionMetadata } from "../shared/metadata.js";

/**
 * The dashboard this account's email infrastructure actually reports to.
 *
 * The CLI used to print `https://app.wraps.dev` unconditionally at the end of
 * `email init`, `connect`, `config`, `upgrade` and `status`. A self-hosted
 * customer — who is paying precisely so their data never reaches us — was told
 * to go and look at our dashboard, which holds none of their sends.
 *
 * Falls back to the platform URL, which is correct for everyone who has not
 * deployed a control plane.
 */
export async function resolveDashboardUrl(
  accountId: string,
  region: string
): Promise<string> {
  try {
    const metadata = await loadConnectionMetadata(accountId, region);
    return metadata?.services?.selfhost?.config?.appUrl || getAppBaseUrl();
    // baseline:allow-next-line no-swallowed-errors — cosmetic; a metadata read
    // failure must never break the command that just succeeded.
  } catch {
    return getAppBaseUrl();
  }
}
