import { afterEach, describe, expect, it, vi } from "vitest";
import { checkBimi } from "../checks/bimi.js";
import { nodeDns, setDnsProvider } from "../dns/index.js";
import type { DnsProvider } from "../types.js";

const VALID_SVG = `<svg version="1.2" baseProfile="tiny-ps" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><title>Example Co</title><circle cx="50" cy="50" r="40"/></svg>`;
const SCRIPT_SVG = `<svg version="1.2" baseProfile="tiny-ps" viewBox="0 0 100 100"><title>Example Co</title><script>alert(1)</script></svg>`;

/** Inject a DNS provider that serves the given TXT records by name. */
function mockDns(records: Record<string, string[]>): void {
  const provider: DnsProvider = {
    resolveTxt: (domain: string) =>
      Promise.resolve((records[domain] ?? []).map((r) => [r])),
    resolveMx: () => Promise.resolve([]),
    resolveA: () => Promise.resolve([]),
    resolveAaaa: () => Promise.resolve([]),
    resolvePtr: () => Promise.resolve([]),
    resolveCaa: () => Promise.resolve([]),
    resolveCname: () => Promise.resolve([]),
  };
  setDnsProvider(provider);
}

function mockFetch(
  responses: Record<string, { ok: boolean; status?: number; body?: string }>
) {
  return vi.fn((url: string) => {
    const response = responses[url];
    if (!response) {
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }
    return Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 404),
      text: () => Promise.resolve(response.body ?? ""),
    } as Response);
  });
}

afterEach(() => {
  setDnsProvider(nodeDns);
  vi.unstubAllGlobals();
});

describe("checkBimi", () => {
  it("marks dmarcCompatible false when DMARC policy is none", async () => {
    mockDns({});
    const result = await checkBimi("example.com", "none");
    expect(result.dmarcCompatible).toBe(false);
  });

  it("marks dmarcCompatible true when DMARC policy is quarantine", async () => {
    mockDns({});
    const result = await checkBimi("example.com", "quarantine");
    expect(result.dmarcCompatible).toBe(true);
  });

  it("marks dmarcCompatible true when DMARC policy is reject", async () => {
    mockDns({});
    const result = await checkBimi("example.com", "reject");
    expect(result.dmarcCompatible).toBe(true);
  });

  it("marks dmarcCompatible false when DMARC policy is null (absent)", async () => {
    mockDns({});
    const result = await checkBimi("example.com", null);
    expect(result.dmarcCompatible).toBe(false);
  });

  it("parses a valid record with l= and a=", async () => {
    mockDns({
      "default._bimi.example.com": [
        "v=BIMI1; l=https://x.com/logo.svg; a=https://x.com/vmc.pem",
      ],
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://x.com/logo.svg": { ok: true, body: VALID_SVG },
        "https://x.com/vmc.pem": { ok: true },
      })
    );

    const result = await checkBimi("example.com", "reject");

    expect(result.configured).toBe(true);
    expect(result.logoUrl).toBe("https://x.com/logo.svg");
    expect(result.vmcUrl).toBe("https://x.com/vmc.pem");
  });

  it("parses a valid record with no a= tag (self-asserted, still valid)", async () => {
    mockDns({
      "default._bimi.example.com": ["v=BIMI1; l=https://x.com/logo.svg"],
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({ "https://x.com/logo.svg": { ok: true, body: VALID_SVG } })
    );

    const result = await checkBimi("example.com", "reject");

    expect(result.configured).toBe(true);
    expect(result.vmcUrl).toBeNull();
  });

  it("returns unconfigured with no error when no record exists", async () => {
    mockDns({});

    const result = await checkBimi("example.com", "reject");

    expect(result.configured).toBe(false);
    expect(result.record).toBeNull();
    expect(result.errors).toEqual([]);
  });

  it("flags a malformed record (wrong version) with a non-empty errors array", async () => {
    mockDns({
      "default._bimi.example.com": ["v=BIMI2; l=https://x.com/logo.svg"],
    });

    const result = await checkBimi("example.com", "reject");

    expect(result.configured).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("flags a malformed record (missing l=) with a non-empty errors array", async () => {
    mockDns({
      "default._bimi.example.com": ["v=BIMI1; a=https://x.com/vmc.pem"],
    });

    const result = await checkBimi("example.com", "reject");

    expect(result.configured).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects an http: logo URL with logoValid false and a scheme error", async () => {
    mockDns({
      "default._bimi.example.com": ["v=BIMI1; l=http://x.com/logo.svg"],
    });

    const result = await checkBimi("example.com", "reject");

    expect(result.logoValid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("https"))).toBe(
      true
    );
  });

  it("marks a compliant tiny-ps SVG with a title as logoValid", async () => {
    mockDns({
      "default._bimi.example.com": ["v=BIMI1; l=https://x.com/logo.svg"],
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({ "https://x.com/logo.svg": { ok: true, body: VALID_SVG } })
    );

    const result = await checkBimi("example.com", "reject");

    expect(result.logoAccessible).toBe(true);
    expect(result.logoValid).toBe(true);
  });

  it("marks an SVG containing <script> as logoValid false", async () => {
    mockDns({
      "default._bimi.example.com": ["v=BIMI1; l=https://x.com/logo.svg"],
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({ "https://x.com/logo.svg": { ok: true, body: SCRIPT_SVG } })
    );

    const result = await checkBimi("example.com", "reject");

    expect(result.logoValid).toBe(false);
  });

  it("marks an oversized SVG as logoValid false", async () => {
    const bigSvg = `<svg version="1.2" baseProfile="tiny-ps" viewBox="0 0 100 100"><title>Example Co</title><!-- ${"x".repeat(
      33 * 1024
    )} --></svg>`;
    mockDns({
      "default._bimi.example.com": ["v=BIMI1; l=https://x.com/logo.svg"],
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({ "https://x.com/logo.svg": { ok: true, body: bigSvg } })
    );

    const result = await checkBimi("example.com", "reject");

    expect(result.logoValid).toBe(false);
  });

  it("captures a DNS resolution failure in result.errors and returns normally", async () => {
    const provider: DnsProvider = {
      resolveTxt: () => Promise.reject(new Error("DNS timeout")),
      resolveMx: () => Promise.resolve([]),
      resolveA: () => Promise.resolve([]),
      resolveAaaa: () => Promise.resolve([]),
      resolvePtr: () => Promise.resolve([]),
      resolveCaa: () => Promise.resolve([]),
      resolveCname: () => Promise.resolve([]),
    };
    setDnsProvider(provider);

    const result = await checkBimi("example.com", "reject");

    expect(result.errors.some((e) => e.includes("DNS timeout"))).toBe(true);
  });
});
