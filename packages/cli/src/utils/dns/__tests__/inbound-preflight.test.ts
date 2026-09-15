/**
 * Tests for the inbound DNS preflight check.
 */

import {
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";
import * as clack from "@clack/prompts";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../shared/json-output.js";
import {
  checkInboundDNSPreflight,
  describeInboundDNSConflict,
  guardInboundDNSWrite,
} from "../inbound-preflight.js";

vi.mock("@clack/prompts", () => ({
  log: { warn: vi.fn() },
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}));

const receivingDomain = "support.example.com";
const region = "us-east-1";

describe("checkInboundDNSPreflight - cloudflare", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(records: Array<{ type: string; content: string }>) {
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      const urlStr = String(url);
      const typeMatch = urlStr.match(/type=(\w+)/);
      const type = typeMatch?.[1];
      const matching = records.filter((r) => r.type === type);
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            result: matching.map((r, i) => ({
              id: `rec-${i}`,
              name: receivingDomain,
              type: r.type,
              content: r.content,
            })),
          }),
      } as Response);
    });
  }

  it("returns all five existing Google MX values and reports alreadyPointsAtSes: false", async () => {
    const googleMx = [
      "1 aspmx.l.google.com",
      "5 alt1.aspmx.l.google.com",
      "5 alt2.aspmx.l.google.com",
      "10 alt3.aspmx.l.google.com",
      "10 alt4.aspmx.l.google.com",
    ];
    mockFetch(googleMx.map((content) => ({ type: "MX", content })));

    const result = await checkInboundDNSPreflight(
      { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.checked).toBe(true);
    expect(result.existingMx).toEqual(googleMx);
    expect(result.alreadyPointsAtSes).toBe(false);
  });

  it("reports alreadyPointsAtSes: true when an SES MX for the region is present", async () => {
    mockFetch([
      { type: "MX", content: "10 inbound-smtp.us-east-1.amazonaws.com" },
    ]);

    const result = await checkInboundDNSPreflight(
      { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.alreadyPointsAtSes).toBe(true);
  });

  it("detects an existing v=spf1 TXT and excludes a non-SPF TXT", async () => {
    mockFetch([
      { type: "TXT", content: "v=spf1 include:othersender.com ~all" },
      { type: "TXT", content: "google-site-verification=abc123" },
    ]);

    const result = await checkInboundDNSPreflight(
      { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.existingSpf).toEqual(["v=spf1 include:othersender.com ~all"]);
  });

  it("detects a quote-wrapped v=spf1 TXT as SPF", async () => {
    mockFetch([
      { type: "TXT", content: '"v=spf1 include:othersender.com ~all"' },
    ]);

    const result = await checkInboundDNSPreflight(
      { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.existingSpf).toHaveLength(1);
  });

  it("returns checked: false with empty arrays when the API request fails", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.reject(new Error("network error"))
    );

    const result = await checkInboundDNSPreflight(
      { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.checked).toBe(false);
    expect(result.existingMx).toEqual([]);
    expect(result.existingSpf).toEqual([]);
    expect(result.alreadyPointsAtSes).toBe(false);
  });
});

describe("checkInboundDNSPreflight - vercel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(records: Array<{ type: string; content: string }>) {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            records: records.map((r, i) => ({
              id: `rec-${i}`,
              name: "support",
              type: r.type,
              value: r.content,
            })),
          }),
      } as Response)
    );
  }

  it("returns all five existing Google MX values and reports alreadyPointsAtSes: false", async () => {
    const googleMx = [
      "1 aspmx.l.google.com",
      "5 alt1.aspmx.l.google.com",
      "5 alt2.aspmx.l.google.com",
      "10 alt3.aspmx.l.google.com",
      "10 alt4.aspmx.l.google.com",
    ];
    mockFetch(googleMx.map((content) => ({ type: "MX", content })));

    const result = await checkInboundDNSPreflight(
      { provider: "vercel", token: "tok" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.checked).toBe(true);
    expect(result.existingMx).toEqual(googleMx);
    expect(result.alreadyPointsAtSes).toBe(false);
  });

  it("reports alreadyPointsAtSes: true when an SES MX for the region is present", async () => {
    mockFetch([
      { type: "MX", content: "10 inbound-smtp.us-east-1.amazonaws.com" },
    ]);

    const result = await checkInboundDNSPreflight(
      { provider: "vercel", token: "tok" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.alreadyPointsAtSes).toBe(true);
  });

  it("detects an existing v=spf1 TXT and excludes a non-SPF TXT", async () => {
    mockFetch([
      { type: "TXT", content: "v=spf1 include:othersender.com ~all" },
      { type: "TXT", content: "google-site-verification=abc123" },
    ]);

    const result = await checkInboundDNSPreflight(
      { provider: "vercel", token: "tok" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.existingSpf).toEqual(["v=spf1 include:othersender.com ~all"]);
  });

  it("detects a quote-wrapped v=spf1 TXT as SPF", async () => {
    mockFetch([
      { type: "TXT", content: '"v=spf1 include:othersender.com ~all"' },
    ]);

    const result = await checkInboundDNSPreflight(
      { provider: "vercel", token: "tok" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.existingSpf).toHaveLength(1);
  });

  it("returns checked: false with empty arrays when the API request fails", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.reject(new Error("network error"))
    );

    const result = await checkInboundDNSPreflight(
      { provider: "vercel", token: "tok" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.checked).toBe(false);
    expect(result.existingMx).toEqual([]);
    expect(result.existingSpf).toEqual([]);
    expect(result.alreadyPointsAtSes).toBe(false);
  });
});

describe("checkInboundDNSPreflight - route53", () => {
  const route53Mock = mockClient(Route53Client);
  const hostedZoneId = "Z123456789";

  beforeEach(() => {
    route53Mock.reset();
  });

  it("detects an MX record in the zone, normalising a trailing-dot zone name against a bare argument", async () => {
    route53Mock.on(ListResourceRecordSetsCommand).resolves({
      ResourceRecordSets: [
        {
          Name: `${receivingDomain}.`,
          Type: "MX",
          TTL: 3600,
          ResourceRecords: [{ Value: "1 aspmx.l.google.com" }],
        },
      ],
      IsTruncated: false,
    });

    const result = await checkInboundDNSPreflight(
      { provider: "route53", hostedZoneId },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.checked).toBe(true);
    expect(result.existingMx).toEqual(["1 aspmx.l.google.com"]);
  });

  it("returns checked: false when ListResourceRecordSets is denied", async () => {
    route53Mock.on(ListResourceRecordSetsCommand).rejects(
      Object.assign(new Error("User is not authorized"), {
        name: "AccessDeniedException",
        $metadata: { httpStatusCode: 403 },
      })
    );

    const result = await checkInboundDNSPreflight(
      { provider: "route53", hostedZoneId },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result.checked).toBe(false);
    expect(result.existingMx).toEqual([]);
    expect(result.existingSpf).toEqual([]);
  });
});

describe("checkInboundDNSPreflight - manual", () => {
  it("returns checked: false without making any network call", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    const result = await checkInboundDNSPreflight(
      { provider: "manual" },
      receivingDomain,
      region,
      "example.com"
    );

    expect(result).toEqual({
      checked: false,
      existingMx: [],
      existingSpf: [],
      alreadyPointsAtSes: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("describeInboundDNSConflict", () => {
  it("returns severity 'unverified' when the preflight could not read the provider", () => {
    const conflict = describeInboundDNSConflict(
      {
        checked: false,
        existingMx: [],
        existingSpf: [],
        alreadyPointsAtSes: false,
      },
      receivingDomain
    );

    expect(conflict.severity).toBe("unverified");
  });

  it("returns severity 'mx-conflict' when a non-SES MX already exists", () => {
    const conflict = describeInboundDNSConflict(
      {
        checked: true,
        existingMx: ["1 aspmx.l.google.com"],
        existingSpf: [],
        alreadyPointsAtSes: false,
      },
      receivingDomain
    );

    expect(conflict.severity).toBe("mx-conflict");
    expect(conflict.message).toContain("alongside");
    expect(conflict.message).not.toContain("replace");
  });

  it("returns severity 'spf-conflict' when SPF exists but MX does not conflict", () => {
    const conflict = describeInboundDNSConflict(
      {
        checked: true,
        existingMx: [],
        existingSpf: ["v=spf1 -all"],
        alreadyPointsAtSes: false,
      },
      receivingDomain
    );

    expect(conflict.severity).toBe("spf-conflict");
  });

  it("returns severity 'ok' on a re-run where the MX already points at SES", () => {
    const conflict = describeInboundDNSConflict(
      {
        checked: true,
        existingMx: ["10 inbound-smtp.us-east-1.amazonaws.com"],
        existingSpf: [],
        alreadyPointsAtSes: true,
      },
      receivingDomain
    );

    expect(conflict.severity).toBe("ok");
  });
});

describe("guardInboundDNSWrite", () => {
  const parentDomain = "example.com";

  beforeEach(() => {
    vi.clearAllMocks();
    setJsonMode(false);
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.isCancel).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockCloudflareFetch(
    records: Array<{ type: string; content: string }>
  ) {
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      const urlStr = String(url);
      const typeMatch = urlStr.match(/type=(\w+)/);
      const type = typeMatch?.[1];
      const matching = records.filter((r) => r.type === type);
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            result: matching.map((r, i) => ({
              id: `rec-${i}`,
              name: receivingDomain,
              type: r.type,
              content: r.content,
            })),
          }),
      } as Response);
    });
  }

  it("throws INBOUND_MX_CONFLICT when a non-SES MX exists and yes: true", async () => {
    mockCloudflareFetch([{ type: "MX", content: "1 aspmx.l.google.com" }]);

    await expect(
      guardInboundDNSWrite({
        credentials: { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
        receivingDomain,
        region,
        parentDomain,
        yes: true,
      })
    ).rejects.toMatchObject({ code: "INBOUND_MX_CONFLICT" });

    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("prompts to confirm when a non-SES MX exists and yes: false; declining does not proceed", async () => {
    mockCloudflareFetch([{ type: "MX", content: "1 aspmx.l.google.com" }]);
    vi.mocked(clack.confirm).mockResolvedValueOnce(false);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    await guardInboundDNSWrite({
      credentials: { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
      receivingDomain,
      region,
      parentDomain,
      yes: false,
    });

    expect(clack.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ initialValue: false })
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("warns but does not throw when only an SPF conflict exists, even with yes: true", async () => {
    mockCloudflareFetch([{ type: "TXT", content: "v=spf1 -all" }]);

    await expect(
      guardInboundDNSWrite({
        credentials: { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
        receivingDomain,
        region,
        parentDomain,
        yes: true,
      })
    ).resolves.toBeUndefined();

    expect(clack.log.warn).toHaveBeenCalled();
    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("proceeds silently when the MX already points at SES for the region", async () => {
    mockCloudflareFetch([
      { type: "MX", content: "10 inbound-smtp.us-east-1.amazonaws.com" },
    ]);

    await expect(
      guardInboundDNSWrite({
        credentials: { provider: "cloudflare", token: "tok", zoneId: "zone-1" },
        receivingDomain,
        region,
        parentDomain,
        yes: true,
      })
    ).resolves.toBeUndefined();

    expect(clack.log.warn).not.toHaveBeenCalled();
    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("warns but does not throw for manual credentials (unreadable provider), even with yes: true", async () => {
    await expect(
      guardInboundDNSWrite({
        credentials: { provider: "manual" },
        receivingDomain,
        region,
        parentDomain,
        yes: true,
      })
    ).resolves.toBeUndefined();

    expect(clack.log.warn).toHaveBeenCalled();
    expect(clack.confirm).not.toHaveBeenCalled();
  });
});
