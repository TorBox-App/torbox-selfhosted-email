import { GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import {
  ListConfigurationSetsCommand,
  ListEmailIdentitiesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

/**
 * Discovery of the `wraps email init` stack a self-hosted dashboard sends its
 * auth email through.
 *
 * Shared by both self-hosted variants and therefore not in `scripts/selfhost/`:
 * the SST variant bakes these into the dashboard's env at deploy time, and the
 * Pulumi variant hands them to the operator through `wraps selfhost env`
 * because it deploys no dashboard of its own.
 *
 * Both probes use the ambient credentials and the deploy region — a
 * self-hosted control plane is assumed to live in the same AWS account as the
 * SES resources it sends through.
 */
export type EmailStack = {
  roleArn: string | null;
  configSetName: string | null;
  /** Verified DOMAIN identities, sorted so deploy output is reproducible. */
  verifiedDomains: string[];
};

export async function detectEmailStack(region: string): Promise<EmailStack> {
  try {
    const iam = new IAMClient({ region });
    const ses = new SESv2Client({ region });
    const [roleResult, setsResult, identitiesResult] = await Promise.allSettled(
      [
        iam.send(new GetRoleCommand({ RoleName: "wraps-email-role" })),
        ses.send(new ListConfigurationSetsCommand({})),
        ses.send(new ListEmailIdentitiesCommand({})),
      ]
    );

    const roleArn =
      roleResult.status === "fulfilled"
        ? (roleResult.value.Role?.Arn ?? null)
        : null;

    const sets =
      setsResult.status === "fulfilled"
        ? (setsResult.value.ConfigurationSets ?? []).filter((n) =>
            n.startsWith("wraps-email-")
          )
        : [];
    const configSetName =
      sets.find((n) => n !== "wraps-email-tracking") ?? sets[0] ?? null;

    // EMAIL_ADDRESS identities are excluded on purpose: they authorise exactly
    // one address, which is almost never the noreply@ the dashboard sends as.
    const verifiedDomains =
      identitiesResult.status === "fulfilled"
        ? (identitiesResult.value.EmailIdentities ?? [])
            .filter(
              (i) => i.IdentityType === "DOMAIN" && i.SendingEnabled === true
            )
            .map((i) => i.IdentityName)
            .filter((n): n is string => Boolean(n))
            .sort()
        : [];

    return { roleArn, configSetName, verifiedDomains };
  } catch {
    return { roleArn: null, configSetName: null, verifiedDomains: [] };
  }
}

/**
 * Pick the address the dashboard sends auth email as.
 *
 * This used to be `noreply@${webDomain}` — the DASHBOARD's domain, which is
 * only sendable if it happens to also be the verified SES domain. A self-hoster
 * whose dashboard is app.example.com but who verified mail.example.com in SES
 * got an unverified identity and every signup, invitation and reset silently
 * failed with "Email address is not verified".
 *
 * The verified identity is the source of truth. The dashboard domain only gets
 * to break the tie, because `noreply@<dashboard>` reads better to recipients
 * when it is sendable — SES treats a verified parent domain as covering its
 * subdomains, so that holds for app.example.com under a verified example.com.
 *
 * Returns null rather than guessing: no AUTH_EMAIL_FROM at all is a visible
 * misconfiguration, where a wrong one is a silent bounce.
 */
export function resolveAuthEmailFrom(options: {
  webDomain?: string;
  verifiedDomains: string[];
}): string | null {
  const { webDomain, verifiedDomains } = options;
  if (verifiedDomains.length === 0) {
    return null;
  }

  const dashboardIsSendable =
    webDomain &&
    verifiedDomains.some(
      (domain) => webDomain === domain || webDomain.endsWith(`.${domain}`)
    );

  return `noreply@${dashboardIsSendable ? webDomain : verifiedDomains[0]}`;
}

/** The dashboard domain implied by an app URL, for resolveAuthEmailFrom. */
export function domainFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return;
  }
}
