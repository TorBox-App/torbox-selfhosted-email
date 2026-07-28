import { findCloudflareZoneId } from "../../packages/cli/src/utils/dns/credentials.js";

export const DNS_PROVIDERS = ["route53", "cloudflare", "none"] as const;
export type DnsProvider = (typeof DNS_PROVIDERS)[number];

export type ResolveDnsOptions = {
  webDomain?: string;
  dnsProvider?: string;
  cloudflareApiToken?: string;
  cloudflareZoneId?: string;
  acmCertArn?: string;
};

export type ResolvedDns = {
  provider: DnsProvider;
  /** Lines appended to .env.selfhost so `upgrade` reuses the same settings. */
  envLines: string[];
  /**
   * Vars the sst subprocess needs at app() evaluation time. app() runs before
   * run()'s dotenv load, so the provider declaration and its token cannot come
   * from the env file — same constraint as SELFHOST_AWS_REGION.
   */
  sstEnv: Record<string, string>;
};

const EMPTY: ResolvedDns = { provider: "route53", envLines: [], sstEnv: {} };

function isDnsProvider(value: string): value is DnsProvider {
  return (DNS_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Decide which DNS adapter the SST config should use for the web domain.
 *
 * Without a web domain the deployment serves on its CloudFront URL and no DNS
 * is involved at all, so this is a no-op — which is also the escape hatch for
 * an operator on an unsupported provider who just wants to get running.
 */
export async function resolveDnsConfig(
  options: ResolveDnsOptions
): Promise<ResolvedDns> {
  if (!options.webDomain) {
    return EMPTY;
  }

  const provider = options.dnsProvider || "route53";
  if (!isDnsProvider(provider)) {
    throw new Error(
      `Unknown --dns-provider "${provider}". Expected one of: ${DNS_PROVIDERS.join(", ")}.`
    );
  }

  if (provider === "route53") {
    // The domain must already have a Route 53 hosted zone in this account.
    // SST performs that lookup itself and reports a clear error if it is
    // missing, so there is nothing to resolve up front.
    return { provider, envLines: [], sstEnv: {} };
  }

  if (provider === "none") {
    if (!options.acmCertArn) {
      throw new Error(
        "--dns-provider none requires --acm-cert-arn. Request a certificate for the web domain in us-east-1 (the only region CloudFront accepts), validate it with your DNS provider, then pass its ARN."
      );
    }
    return {
      provider,
      envLines: [`SELFHOST_ACM_CERT_ARN=${options.acmCertArn}`],
      sstEnv: {},
    };
  }

  const apiToken =
    options.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "--dns-provider cloudflare requires a Cloudflare API token with the 'Edit zone DNS' permission. Pass --cloudflare-api-token or set CLOUDFLARE_API_TOKEN."
    );
  }

  // findCloudflareZoneId falls back to the parent zone, so a web domain like
  // mail.example.com resolves against the example.com zone.
  const zoneId =
    options.cloudflareZoneId ||
    (await findCloudflareZoneId(apiToken, options.webDomain));
  if (!zoneId) {
    throw new Error(
      `No Cloudflare zone found for ${options.webDomain}. Check that the domain is in this Cloudflare account and that the token can read it, or pass --cloudflare-zone-id explicitly.`
    );
  }

  return {
    provider,
    envLines: [
      `CLOUDFLARE_API_TOKEN=${apiToken}`,
      `SELFHOST_CLOUDFLARE_ZONE_ID=${zoneId}`,
    ],
    sstEnv: {
      CLOUDFLARE_API_TOKEN: apiToken,
      SELFHOST_CLOUDFLARE_ZONE_ID: zoneId,
    },
  };
}
