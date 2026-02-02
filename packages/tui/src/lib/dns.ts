import { Resolver } from "node:dns/promises";
import type { DnsStatus, DomainStatus } from "../types";
import type { SESIdentity } from "./aws";

export async function checkDomainDns(
  identity: SESIdentity
): Promise<DomainStatus> {
  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);

  const dkimStatus = await checkDkim(
    resolver,
    identity.name,
    identity.dkimTokens
  );
  const spfStatus = await checkSpf(resolver, identity.name);
  const dmarcStatus = await checkDmarc(resolver, identity.name);

  return {
    name: identity.name,
    verified: identity.verified,
    dkimStatus,
    spfStatus,
    dmarcStatus,
  };
}

async function checkDkim(
  resolver: Resolver,
  domain: string,
  tokens: string[]
): Promise<DnsStatus> {
  if (tokens.length === 0) return "pending";

  let allOk = true;
  for (const token of tokens) {
    const record = `${token}._domainkey.${domain}`;
    try {
      const cnames = await resolver.resolveCname(record);
      const expected = `${token}.dkim.amazonses.com`;
      const found = cnames.some((r) => r === expected || r === `${expected}.`);
      if (!found) allOk = false;
    } catch {
      allOk = false;
    }
  }
  return allOk ? "ok" : "pending";
}

async function checkSpf(
  resolver: Resolver,
  domain: string
): Promise<DnsStatus> {
  try {
    const records = await resolver.resolveTxt(domain);
    const spf = records.flat().find((r) => r.startsWith("v=spf1"));
    if (!spf) return "pending";
    return spf.includes("include:amazonses.com") ? "ok" : "error";
  } catch {
    return "pending";
  }
}

async function checkDmarc(
  resolver: Resolver,
  domain: string
): Promise<DnsStatus> {
  try {
    const records = await resolver.resolveTxt(`_dmarc.${domain}`);
    const dmarc = records.flat().find((r) => r.startsWith("v=DMARC1"));
    return dmarc ? "ok" : "pending";
  } catch {
    return "pending";
  }
}
