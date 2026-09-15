/**
 * Tests for outbound email DNS cleanup — the delete-side of
 * `buildEmailDNSRecords`, used by `wraps email destroy`.
 *
 * The load-bearing guarantees under test throughout this file:
 *
 * 1. Every deletion is matched on name + type + exact value, never name+type
 *    alone. A name can carry several TXT or MX records (a customer's own
 *    DMARC policy, a verification TXT, an existing MX provider), and
 *    deleting "the first one" can remove a record Wraps did not create.
 * 2. Route53 `DELETE` removes an entire record set. A set carrying values
 *    Wraps did not create is `UPSERT`ed with Wraps' value subtracted —
 *    never bare-`DELETE`d.
 * 3. The apex SPF record is never touched by any provider, under any
 *    circumstance — it may carry other providers' includes merged into
 *    Wraps', so removing `include:amazonses.com` from it is a rewrite, not
 *    a deletion, and stays out of scope entirely.
 *
 * Fixture-ordering rule (learned on plan 310): in any test asserting that a
 * non-Wraps record is *not* deleted, the non-Wraps record is listed FIRST in
 * the fixture. With the Wraps record first, a buggy "delete/report the first
 * name+type match" implementation would pass by coincidence.
 */

import {
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteEmailDNSRecordsForProvider } from "../email-dns-cleanup.js";
import type { EmailDNSRecordData } from "../types.js";

const region = "us-east-1";
const domain = "example.com";
const apexSpfValue = "v=spf1 include:amazonses.com ~all";

type FetchRoute = {
  match: (url: string, method: string) => boolean;
  respond: (url: string, method: string) => unknown;
};

function routedFetch(routes: FetchRoute[]) {
  return vi.fn((url: unknown, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? "GET";
    const route = routes.find((r) => r.match(urlStr, method));
    if (!route) {
      throw new Error(`Unhandled fetch: ${method} ${urlStr}`);
    }
    return Promise.resolve({
      json: () => Promise.resolve(route.respond(urlStr, method)),
    } as Response);
  });
}

describe("deleteEmailDNSRecordsForProvider — route53", () => {
  const route53Mock = mockClient(Route53Client);
  const hostedZoneId = "Z123456789";

  beforeEach(() => {
    route53Mock.reset();
    // Default: nothing exists anywhere, unless a test overrides a specific
    // StartRecordName below.
    route53Mock
      .on(ListResourceRecordSetsCommand)
      .resolves({ ResourceRecordSets: [], IsTruncated: false });
    route53Mock.on(ChangeResourceRecordSetsCommand).resolves({});
  });

  async function run(
    data: Partial<EmailDNSRecordData> = {}
  ): Promise<ReturnType<typeof deleteEmailDNSRecordsForProvider>> {
    return deleteEmailDNSRecordsForProvider(
      { provider: "route53", hostedZoneId },
      { domain, dkimTokens: [], region, ...data }
    );
  }

  it("does not delete a customer-authored DMARC policy Wraps did not write — zero change calls", async () => {
    route53Mock
      .on(ListResourceRecordSetsCommand, {
        StartRecordName: `_dmarc.${domain}`,
      })
      .resolves({
        ResourceRecordSets: [
          {
            Name: `_dmarc.${domain}.`,
            Type: "TXT",
            TTL: 900,
            // A DMARC policy that pre-dates Wraps — different `p=` value.
            ResourceRecords: [{ Value: '"v=DMARC1; p=reject; pct=100"' }],
          },
        ],
        IsTruncated: false,
      });

    const result = await run();

    expect(result.deleted).toEqual([]);
    expect(
      result.skipped.some((s) => s.record === `TXT _dmarc.${domain}`)
    ).toBe(true);
    expect(
      route53Mock.commandCalls(ChangeResourceRecordSetsCommand)
    ).toHaveLength(0);
  });

  it("UPSERTs the MAIL FROM TXT set minus Wraps' SPF value when a verification TXT is also present — never a DELETE", async () => {
    const mailFromDomain = `mail.${domain}`;
    const mailfromSpfValue = `"${apexSpfValue}"`;

    route53Mock
      .on(ListResourceRecordSetsCommand, { StartRecordName: mailFromDomain })
      .resolves({
        ResourceRecordSets: [
          {
            Name: `${mailFromDomain}.`,
            Type: "TXT",
            TTL: 1800,
            // Non-Wraps verification value listed FIRST deliberately.
            ResourceRecords: [
              { Value: '"google-site-verification=abc123"' },
              { Value: mailfromSpfValue },
            ],
          },
        ],
        IsTruncated: false,
      });

    const result = await run({ mailFromDomain });

    expect(result.deleted).toContain(`TXT ${mailFromDomain}`);

    const changes = route53Mock.commandCalls(ChangeResourceRecordSetsCommand);
    expect(changes).toHaveLength(1);
    const txtChange = changes[0].args[0].input.ChangeBatch?.Changes?.find(
      (c) => c.ResourceRecordSet?.Type === "TXT"
    );
    expect(txtChange?.Action).toBe("UPSERT");
    const values = txtChange?.ResourceRecordSet?.ResourceRecords?.map(
      (r) => r.Value
    );
    expect(values).toEqual(['"google-site-verification=abc123"']);
    expect(values).not.toContain(mailfromSpfValue);
  });

  it("DELETEs the DMARC set when Wraps' value is its only member", async () => {
    const dmarcValue = `v=DMARC1; p=quarantine; sp=quarantine; np=reject; rua=mailto:postmaster@${domain}`;

    route53Mock
      .on(ListResourceRecordSetsCommand, {
        StartRecordName: `_dmarc.${domain}`,
      })
      .resolves({
        ResourceRecordSets: [
          {
            Name: `_dmarc.${domain}.`,
            Type: "TXT",
            TTL: 1800,
            ResourceRecords: [{ Value: `"${dmarcValue}"` }],
          },
        ],
        IsTruncated: false,
      });

    const result = await run();

    expect(result.deleted).toContain(`TXT _dmarc.${domain}`);
    const changes = route53Mock.commandCalls(ChangeResourceRecordSetsCommand);
    expect(changes).toHaveLength(1);
    const change = changes[0].args[0].input.ChangeBatch?.Changes?.[0];
    expect(change?.Action).toBe("DELETE");
  });

  it("deletes a DKIM CNAME present with Wraps' target", async () => {
    const dkimName = `tok1._domainkey.${domain}`;
    const dkimValue = "tok1.dkim.amazonses.com";

    route53Mock
      .on(ListResourceRecordSetsCommand, { StartRecordName: dkimName })
      .resolves({
        ResourceRecordSets: [
          {
            Name: `${dkimName}.`,
            Type: "CNAME",
            TTL: 1800,
            ResourceRecords: [{ Value: dkimValue }],
          },
        ],
        IsTruncated: false,
      });

    const result = await run({ dkimTokens: ["tok1"] });

    expect(result.deleted).toContain(`CNAME ${dkimName}`);
    const changes = route53Mock.commandCalls(ChangeResourceRecordSetsCommand);
    expect(changes).toHaveLength(1);
    expect(changes[0].args[0].input.ChangeBatch?.Changes?.[0]?.Action).toBe(
      "DELETE"
    );
  });

  it("skips a DKIM CNAME whose target does not match what Wraps created", async () => {
    const dkimName = `tok1._domainkey.${domain}`;

    route53Mock
      .on(ListResourceRecordSetsCommand, { StartRecordName: dkimName })
      .resolves({
        ResourceRecordSets: [
          {
            Name: `${dkimName}.`,
            Type: "CNAME",
            TTL: 1800,
            // A different target — this name was repointed since Wraps set it up.
            ResourceRecords: [{ Value: "somewhere-else.example.net" }],
          },
        ],
        IsTruncated: false,
      });

    const result = await run({ dkimTokens: ["tok1"] });

    expect(result.deleted).toEqual([]);
    expect(result.skipped.some((s) => s.record === `CNAME ${dkimName}`)).toBe(
      true
    );
    expect(
      route53Mock.commandCalls(ChangeResourceRecordSetsCommand)
    ).toHaveLength(0);
  });

  it("finds a CNAME on the second page of a paginated zone — the MaxItems: 500 bug", async () => {
    const dkimName = `tok1._domainkey.${domain}`;
    const dkimValue = "tok1.dkim.amazonses.com";

    route53Mock
      .on(ListResourceRecordSetsCommand, { StartRecordName: dkimName })
      .resolvesOnce({
        // A record at the SAME name but a type we're not looking for —
        // still "at" the target name, so pagination must continue rather
        // than treating this as having moved past it.
        ResourceRecordSets: [
          {
            Name: `${dkimName}.`,
            Type: "TXT",
            TTL: 300,
            ResourceRecords: [{ Value: '"unrelated"' }],
          },
        ],
        IsTruncated: true,
        NextRecordName: dkimName,
        NextRecordType: "CNAME",
      })
      .resolvesOnce({
        ResourceRecordSets: [
          {
            Name: `${dkimName}.`,
            Type: "CNAME",
            TTL: 1800,
            ResourceRecords: [{ Value: dkimValue }],
          },
        ],
        IsTruncated: false,
      });

    const result = await run({ dkimTokens: ["tok1"] });

    expect(result.deleted).toContain(`CNAME ${dkimName}`);
    const calls = route53Mock.commandCalls(ListResourceRecordSetsCommand);
    const callsForName = calls.filter(
      (c) => c.args[0].input.StartRecordName === dkimName
    );
    expect(callsForName).toHaveLength(2);
  });

  it("never includes the apex SPF record in any lookup or change, even with every optional category present", async () => {
    await run({
      dkimTokens: ["tok1", "tok2"],
      mailFromDomain: `mail.${domain}`,
      customTrackingDomain: `links.${domain}`,
    });

    const listCalls = route53Mock.commandCalls(ListResourceRecordSetsCommand);
    expect(
      listCalls.some((c) => c.args[0].input.StartRecordName === domain)
    ).toBe(false);

    const changeCalls = route53Mock.commandCalls(
      ChangeResourceRecordSetsCommand
    );
    for (const call of changeCalls) {
      for (const change of call.args[0].input.ChangeBatch?.Changes ?? []) {
        expect(change.ResourceRecordSet?.Name).not.toBe(domain);
        expect(change.ResourceRecordSet?.Name).not.toBe(`${domain}.`);
      }
    }
  });

  it("reports an error and issues no change call when ListResourceRecordSets fails", async () => {
    route53Mock.reset();
    route53Mock.on(ListResourceRecordSetsCommand).rejects(
      Object.assign(new Error("User is not authorized"), {
        name: "AccessDeniedException",
        $metadata: { httpStatusCode: 403 },
      })
    );

    const result = await run();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.deleted).toEqual([]);
    expect(
      route53Mock.commandCalls(ChangeResourceRecordSetsCommand)
    ).toHaveLength(0);
  });
});

describe("deleteEmailDNSRecordsForProvider — cloudflare", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes only Wraps' DMARC value, leaving a non-Wraps TXT on the same name alone", async () => {
    const deletedIds: string[] = [];
    const dmarcValue = `v=DMARC1; p=quarantine; sp=quarantine; np=reject; rua=mailto:postmaster@${domain}`;

    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (url, method) => method === "GET" && url.includes("type=MX"),
          respond: () => ({ success: true, result: [] }),
        },
        {
          match: (url, method) => method === "GET" && url.includes("type=TXT"),
          respond: () => ({
            success: true,
            // Non-Wraps record listed FIRST deliberately: a "delete the
            // first match" implementation would delete this instead.
            result: [
              {
                id: "txt-other",
                name: `_dmarc.${domain}`,
                type: "TXT",
                content: "v=DMARC1; p=reject",
              },
              {
                id: "txt-dmarc",
                name: `_dmarc.${domain}`,
                type: "TXT",
                content: dmarcValue,
              },
            ],
          }),
        },
        {
          match: (url, method) =>
            method === "GET" && url.includes("type=CNAME"),
          respond: () => ({ success: true, result: [] }),
        },
        {
          match: (url, method) => method === "DELETE",
          respond: (url) => {
            deletedIds.push(url.split("/").pop() as string);
            return { success: true, result: { id: "deleted" } };
          },
        },
      ])
    );

    const result = await deleteEmailDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      { domain, dkimTokens: [], region }
    );

    expect(deletedIds).toEqual(["txt-dmarc"]);
    expect(deletedIds).not.toContain("txt-other");
    expect(result.deleted).toContain(`TXT _dmarc.${domain}`);
  });

  it("never queries or deletes the apex SPF record", async () => {
    const requestedNames: string[] = [];
    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (url, method) => method === "GET",
          respond: (url) => {
            const parsed = new URL(url);
            requestedNames.push(
              `${parsed.searchParams.get("name")}|${parsed.searchParams.get("type")}`
            );
            return { success: true, result: [] };
          },
        },
        {
          match: (_url, method) => method === "DELETE",
          respond: () => ({ success: true, result: { id: "deleted" } }),
        },
      ])
    );

    await deleteEmailDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      {
        domain,
        dkimTokens: ["tok1"],
        region,
        mailFromDomain: `mail.${domain}`,
        customTrackingDomain: `links.${domain}`,
      }
    );

    expect(requestedNames).not.toContain(`${domain}|TXT`);
  });

  it("reports an error and issues no DELETE call when the provider's list request fails", async () => {
    let deleteCalls = 0;
    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (_url, method) => method === "GET",
          respond: () => ({
            success: false,
            errors: [{ code: 1000, message: "Invalid API Token" }],
          }),
        },
        {
          match: (_url, method) => method === "DELETE",
          respond: () => {
            deleteCalls++;
            return { success: true, result: { id: "deleted" } };
          },
        },
      ])
    );

    const result = await deleteEmailDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      { domain, dkimTokens: [], region }
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(deleteCalls).toBe(0);
  });
});

describe("deleteEmailDNSRecordsForProvider — vercel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves a tracking CNAME at a subdomain to its relative name and deletes it", async () => {
    const deletedIds: string[] = [];
    const trackingDomain = `links.${domain}`;
    const trackingValue = `r.${region}.awstrack.me`;

    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (url, method) =>
            method === "GET" && url.includes(`/v4/domains/${domain}/records`),
          respond: () => ({
            records: [
              {
                id: "cname-tracking",
                slug: domain,
                name: "links",
                type: "CNAME",
                value: trackingValue,
                ttl: 1800,
              },
              {
                id: "txt-apex-spf",
                slug: domain,
                name: "@",
                type: "TXT",
                value: apexSpfValue,
                ttl: 1800,
              },
            ],
          }),
        },
        {
          match: (url, method) => method === "DELETE",
          respond: (url) => {
            deletedIds.push((url.split("/").pop() as string).split("?")[0]);
            return { id: "deleted" };
          },
        },
      ])
    );

    const result = await deleteEmailDNSRecordsForProvider(
      { provider: "vercel", token: "tok" },
      { domain, dkimTokens: [], region, customTrackingDomain: trackingDomain }
    );

    expect(deletedIds).toEqual(["cname-tracking"]);
    expect(deletedIds).not.toContain("txt-apex-spf");
    expect(result.deleted).toContain(`CNAME ${trackingDomain}`);
  });
});

describe("deleteEmailDNSRecordsForProvider — manual", () => {
  it("is unsupported and makes no calls", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    const result = await deleteEmailDNSRecordsForProvider(
      { provider: "manual" },
      { domain, dkimTokens: ["tok1"], region }
    );

    expect(result).toEqual({
      deleted: [],
      skipped: [],
      supported: false,
      errors: [],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
