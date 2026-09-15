/**
 * Tests for inbound DNS cleanup — the delete-side of buildInboundDNSRecords.
 *
 * The load-bearing guarantee under test throughout this file: every deletion
 * is matched on name + type + exact value, never name+type alone. A name can
 * carry several TXT or MX records (a customer's own SPF, a
 * `google-site-verification` value, an existing MX provider), and deleting
 * "the first one" can remove a record Wraps did not create.
 */

import {
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteInboundDNSRecordsForProvider } from "../inbound-dns-cleanup.js";

const region = "us-east-1";
const sesMxHost = "inbound-smtp.us-east-1.amazonaws.com";
const sesMxValue = `10 ${sesMxHost}`;
const sesSpfValue = "v=spf1 include:amazonses.com ~all";

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

describe("deleteInboundDNSRecordsForProvider — cloudflare", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes only the Wraps SPF value, leaving a google-site-verification TXT on the same name alone", async () => {
    const deletedIds: string[] = [];
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
            // google-site-verification listed FIRST deliberately: a
            // name+type "delete the first match" implementation (the exact
            // bug this module exists to prevent) would delete this record
            // instead of the SPF one, and the assertion below would catch
            // it — put the Wraps record first and this test would still
            // pass under that bug.
            result: [
              {
                id: "txt-verify",
                name: "support.example.com",
                type: "TXT",
                content: '"google-site-verification=abc123"',
              },
              {
                id: "txt-spf",
                name: "support.example.com",
                type: "TXT",
                content: `"${sesSpfValue}"`,
              },
            ],
          }),
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

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      "support.example.com",
      region,
      "example.com"
    );

    expect(deletedIds).toEqual(["txt-spf"]);
    expect(deletedIds).not.toContain("txt-verify");
    expect(result.deleted).toContain("TXT support.example.com");
    expect(result.supported).toBe(true);
  });

  it("skips a customer SPF that is not byte-identical to what Wraps created", async () => {
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
            result: [
              {
                id: "txt-custom",
                name: "support.example.com",
                type: "TXT",
                content:
                  '"v=spf1 include:amazonses.com include:_spf.google.com -all"',
              },
            ],
          }),
        },
        {
          match: (_url, method) => method === "DELETE",
          respond: () => {
            throw new Error("DELETE must not be called");
          },
        },
      ])
    );

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      "support.example.com",
      region,
      "example.com"
    );

    expect(result.deleted).toEqual([]);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(
      result.skipped.some((s) => s.record === "TXT support.example.com")
    ).toBe(true);
  });

  it("deletes both records when a duplicate MX exists from an earlier double-run", async () => {
    const deletedIds: string[] = [];
    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (url, method) => method === "GET" && url.includes("type=MX"),
          respond: () => ({
            success: true,
            result: [
              {
                id: "mx-1",
                name: "support.example.com",
                type: "MX",
                content: sesMxHost,
                priority: 10,
              },
              {
                id: "mx-2",
                name: "support.example.com",
                type: "MX",
                content: sesMxHost,
                priority: 10,
              },
            ],
          }),
        },
        {
          match: (url, method) => method === "GET" && url.includes("type=TXT"),
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

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      "support.example.com",
      region,
      "example.com"
    );

    expect(deletedIds.sort()).toEqual(["mx-1", "mx-2"]);
    expect(result.deleted).toHaveLength(2);
  });

  it("deletes an MX record whose stored priority differs — priority is not part of the identity", async () => {
    const deletedIds: string[] = [];
    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (url, method) => method === "GET" && url.includes("type=MX"),
          respond: () => ({
            success: true,
            result: [
              {
                id: "mx-1",
                name: "support.example.com",
                type: "MX",
                content: sesMxHost,
                priority: 20,
              },
            ],
          }),
        },
        {
          match: (url, method) => method === "GET" && url.includes("type=TXT"),
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

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      "support.example.com",
      region,
      "example.com"
    );

    expect(deletedIds).toEqual(["mx-1"]);
    expect(result.deleted).toContain("MX support.example.com");
  });

  it("deletes a TXT record whose value arrives quote-wrapped", async () => {
    const deletedIds: string[] = [];
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
            result: [
              {
                id: "txt-1",
                name: "support.example.com",
                type: "TXT",
                content: `"${sesSpfValue}"`,
              },
            ],
          }),
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

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      "support.example.com",
      region,
      "example.com"
    );

    expect(deletedIds).toEqual(["txt-1"]);
    expect(result.deleted).toContain("TXT support.example.com");
  });

  it("deletes nothing and reports no errors when no record on the name matches", async () => {
    let deleteCalls = 0;
    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (url, method) => method === "GET" && url.includes("type=MX"),
          respond: () => ({ success: true, result: [] }),
        },
        {
          match: (url, method) => method === "GET" && url.includes("type=TXT"),
          respond: () => ({ success: true, result: [] }),
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

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      "support.example.com",
      region,
      "example.com"
    );

    expect(result.deleted).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(deleteCalls).toBe(0);
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

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "cloudflare", zoneId: "zone1", token: "tok" },
      "support.example.com",
      region,
      "example.com"
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(deleteCalls).toBe(0);
  });
});

describe("deleteInboundDNSRecordsForProvider — vercel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the apex receiving domain to the relative name '@' and deletes it", async () => {
    const deletedIds: string[] = [];
    vi.spyOn(global, "fetch").mockImplementation(
      routedFetch([
        {
          match: (url, method) =>
            method === "GET" && url.includes("/v4/domains/example.com/records"),
          respond: () => ({
            records: [
              {
                id: "mx-apex",
                slug: "example.com",
                name: "@",
                type: "MX",
                value: sesMxHost,
                ttl: 1800,
                mxPriority: 10,
              },
              {
                id: "txt-apex",
                slug: "example.com",
                name: "@",
                type: "TXT",
                value: sesSpfValue,
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

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "vercel", token: "tok" },
      "example.com",
      region,
      "example.com"
    );

    expect(deletedIds.sort()).toEqual(["mx-apex", "txt-apex"]);
    expect(result.deleted).toContain("MX example.com");
    expect(result.deleted).toContain("TXT example.com");
  });
});

describe("deleteInboundDNSRecordsForProvider — route53", () => {
  const route53Mock = mockClient(Route53Client);
  const hostedZoneId = "Z123456789";
  const receivingDomain = "support.example.com";

  beforeEach(() => {
    route53Mock.reset();
  });

  async function run() {
    return deleteInboundDNSRecordsForProvider(
      { provider: "route53", hostedZoneId },
      receivingDomain,
      region,
      "example.com"
    );
  }

  it("UPSERTs the MX set minus the SES value when other MX values are present — never a bare DELETE", async () => {
    const googleMxValues = [
      "1 aspmx.l.google.com",
      "5 alt1.aspmx.l.google.com",
      "5 alt2.aspmx.l.google.com",
      "10 alt3.aspmx.l.google.com",
      "10 alt4.aspmx.l.google.com",
    ];

    route53Mock.on(ListResourceRecordSetsCommand).resolves({
      ResourceRecordSets: [
        {
          Name: `${receivingDomain}.`,
          Type: "MX",
          TTL: 3600,
          ResourceRecords: [...googleMxValues, sesMxValue].map((Value) => ({
            Value,
          })),
        },
      ],
      IsTruncated: false,
    });

    const result = await run();

    expect(result.deleted).toContain(`MX ${receivingDomain}`);

    const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
    const changes = call.args[0].input.ChangeBatch?.Changes;
    const mxChange = changes?.find((c) => c.ResourceRecordSet?.Type === "MX");

    expect(mxChange?.Action).toBe("UPSERT");
    expect(mxChange?.ResourceRecordSet?.TTL).toBe(3600);
    const values = mxChange?.ResourceRecordSet?.ResourceRecords?.map(
      (r) => r.Value
    );
    expect(values).toHaveLength(5);
    for (const googleValue of googleMxValues) {
      expect(values).toContain(googleValue);
    }
    expect(values).not.toContain(sesMxValue);
  });

  it("DELETEs the MX set when the SES value is its only member", async () => {
    route53Mock.on(ListResourceRecordSetsCommand).resolves({
      ResourceRecordSets: [
        {
          Name: `${receivingDomain}.`,
          Type: "MX",
          TTL: 1800,
          ResourceRecords: [{ Value: sesMxValue }],
        },
      ],
      IsTruncated: false,
    });

    const result = await run();

    expect(result.deleted).toContain(`MX ${receivingDomain}`);

    const call = route53Mock.commandCalls(ChangeResourceRecordSetsCommand)[0];
    const changes = call.args[0].input.ChangeBatch?.Changes;
    const mxChange = changes?.find((c) => c.ResourceRecordSet?.Type === "MX");

    expect(mxChange?.Action).toBe("DELETE");
    expect(mxChange?.ResourceRecordSet?.ResourceRecords).toEqual([
      { Value: sesMxValue },
    ]);
  });

  it("reports a skip reason (not silence) when an MX set exists at the name but doesn't contain the SES value", async () => {
    route53Mock.on(ListResourceRecordSetsCommand).resolves({
      ResourceRecordSets: [
        {
          Name: `${receivingDomain}.`,
          Type: "MX",
          TTL: 3600,
          // A pre-existing MX set that was never Wraps' — e.g. the customer
          // repointed it, or `inbound add` never ran for this domain.
          ResourceRecords: [{ Value: "1 aspmx.l.google.com" }],
        },
      ],
      IsTruncated: false,
    });

    const result = await run();

    expect(result.deleted).toEqual([]);
    expect(
      result.skipped.some((s) => s.record === `MX ${receivingDomain}`)
    ).toBe(true);
    expect(
      route53Mock.commandCalls(ChangeResourceRecordSetsCommand)
    ).toHaveLength(0);
  });

  it("leaves a customer SPF that differs from what Wraps created untouched, with no TXT change", async () => {
    route53Mock.on(ListResourceRecordSetsCommand).resolves({
      ResourceRecordSets: [
        {
          Name: `${receivingDomain}.`,
          Type: "TXT",
          TTL: 900,
          ResourceRecords: [{ Value: '"v=spf1 -all"' }],
        },
      ],
      IsTruncated: false,
    });

    const result = await run();

    expect(result.deleted).toEqual([]);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(
      result.skipped.some((s) => s.record === `TXT ${receivingDomain}`)
    ).toBe(true);
    expect(
      route53Mock.commandCalls(ChangeResourceRecordSetsCommand)
    ).toHaveLength(0);
  });

  it("reports an error and issues no DELETE call when ListResourceRecordSets fails", async () => {
    route53Mock.on(ListResourceRecordSetsCommand).rejects(
      Object.assign(new Error("User is not authorized"), {
        name: "AccessDeniedException",
        $metadata: { httpStatusCode: 403 },
      })
    );

    const result = await run();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      route53Mock.commandCalls(ChangeResourceRecordSetsCommand)
    ).toHaveLength(0);
  });
});

describe("deleteInboundDNSRecordsForProvider — manual", () => {
  it("is unsupported and makes no calls", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    const result = await deleteInboundDNSRecordsForProvider(
      { provider: "manual" },
      "support.example.com",
      region,
      "example.com"
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
