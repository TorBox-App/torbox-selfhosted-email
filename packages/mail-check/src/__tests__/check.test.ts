import type { EmailCheckResult } from "@wraps/email-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture console.log output
let output: string[];
const originalLog = console.log;

beforeEach(() => {
  output = [];
  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  console.log = originalLog;
  vi.restoreAllMocks();
});

// Minimal mock result for display tests
function mockResult(
  overrides: Partial<EmailCheckResult> = {}
): EmailCheckResult {
  return {
    domain: "example.com",
    duration: 1000,
    timestamp: new Date().toISOString(),
    score: {
      baseScore: 100,
      finalScore: 95,
      grade: "A",
      deductions: [],
      bonuses: [],
      maxDeductions: {},
    },
    spf: {
      exists: true,
      record: "v=spf1 -all",
      records: ["v=spf1 -all"],
      multipleRecords: false,
      valid: true,
      syntaxErrors: [],
      warnings: [],
      lookupCount: 0,
      lookupLimit: 10,
      lookupTree: [],
      allMechanism: "-all",
      includes: [],
      hasPtr: false,
      hasDuplicates: false,
      hasCircularInclude: false,
      recordLength: 11,
      usesMacros: false,
      macros: [],
    },
    dkim: {
      found: true,
      selectors: [
        {
          selector: "google",
          exists: true,
          record: "v=DKIM1",
          valid: true,
          keyType: "rsa",
          keyBits: 2048,
          publicKey: "abc",
          testMode: false,
          revoked: false,
          expired: false,
          hashAlgorithms: ["sha256"],
          serviceTypes: ["*"],
          flags: [],
          errors: [],
          warnings: [],
        },
      ],
      selectorsChecked: 1,
      earlyExit: true,
      warnings: [],
    },
    dmarc: {
      exists: true,
      record: "v=DMARC1; p=reject",
      valid: true,
      policy: "reject",
      subdomainPolicy: null,
      percentage: 100,
      reportingEnabled: true,
      ruaAddresses: [],
      rufAddresses: [],
      alignmentSpf: "relaxed",
      alignmentDkim: "relaxed",
      errors: [],
      warnings: [],
    },
    mx: {
      exists: true,
      records: [
        {
          priority: 10,
          exchange: "mx.example.com",
          resolves: true,
          ips: ["1.2.3.4"],
        },
      ],
    },
    mxTls: { checked: false, skipped: true, skipReason: "test", servers: [] },
    blacklist: {
      domainChecks: { checked: 0, clean: [], listed: [], errors: [] },
      ipChecks: { checked: 0, clean: [], listed: [], errors: [] },
    },
    reverseDns: { results: [], allHavePtr: true, allConfirm: true },
    ipv6: { mxHasIpv6: false, spfIncludesIpv6: false },
    dnssec: { enabled: false, valid: false },
    caa: { configured: false, allowedIssuers: [] },
    mtaSts: { configured: false, policy: null },
    tlsRpt: { configured: false, record: null, reportingAddresses: [] },
    bimi: {
      configured: false,
      record: null,
      svgUrl: null,
      vmcUrl: null,
      vmcValid: false,
    },
    domainAge: {
      source: "unavailable" as const,
      ageInDays: null,
      createdAt: null,
      registrar: null,
      errors: ["test"],
    },
    ...overrides,
  } as EmailCheckResult;
}

describe("displayScoreBox", () => {
  it("renders grade A with green coloring and correct score", async () => {
    const { displayScoreBox } = await import("../commands/check.js");
    displayScoreBox("example.com", 95, "A");
    const text = output.join("\n");
    expect(text).toContain("mail-audit");
    expect(text).toContain("example.com");
    expect(text).toContain("95/100");
    expect(text).toContain("A");
  });

  it("renders grade F with red coloring", async () => {
    const { displayScoreBox } = await import("../commands/check.js");
    displayScoreBox("bad.com", 20, "F");
    const text = output.join("\n");
    expect(text).toContain("bad.com");
    expect(text).toContain("20/100");
    expect(text).toContain("F");
  });
});

describe("displayResults", () => {
  it("shows issues section when deductions exist", async () => {
    const { displayResults } = await import("../commands/check.js");
    const result = mockResult({
      score: {
        baseScore: 100,
        finalScore: 45,
        grade: "F",
        deductions: [
          { check: "spf", reason: "No SPF record found", points: 30 },
          { check: "dkim", reason: "Weak DKIM key", points: 10 },
        ],
        bonuses: [],
        maxDeductions: {},
      },
    });
    displayResults(result, {});
    const text = output.join("\n");
    expect(text).toContain("ISSUES");
    expect(text).toContain("CRITICAL");
    expect(text).toContain("No SPF record found");
    expect(text).toContain("WARNINGS");
    expect(text).toContain("Weak DKIM key");
  });

  it("shows CTA with wraps.dev URL only when grade is C or below", async () => {
    const { displayResults } = await import("../commands/check.js");

    // Grade F — should show CTA
    const badResult = mockResult({
      score: {
        baseScore: 100,
        finalScore: 30,
        grade: "F",
        deductions: [],
        bonuses: [],
        maxDeductions: {},
      },
    });
    displayResults(badResult, {});
    const badText = output.join("\n");
    expect(badText).toContain("wraps.dev/tools");
    expect(badText).toContain("grade=F");

    // Reset output, test grade A — no CTA
    output = [];
    const goodResult = mockResult({
      score: {
        baseScore: 100,
        finalScore: 95,
        grade: "A",
        deductions: [],
        bonuses: [],
        maxDeductions: {},
      },
    });
    displayResults(goodResult, {});
    const goodText = output.join("\n");
    expect(goodText).not.toContain("wraps.dev/tools");
    expect(goodText).toContain("Excellent");
  });
});

describe("runCheck", () => {
  it("with --json flag outputs valid JSON to stdout", async () => {
    const mockEmailCheck = await import("@wraps/email-check");
    vi.spyOn(mockEmailCheck, "runEmailCheck").mockResolvedValue(mockResult());
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    const { runCheck } = await import("../commands/check.js");
    await runCheck("example.com", { json: true });

    const text = output.join("\n");
    const parsed = JSON.parse(text);
    expect(parsed.domain).toBe("example.com");
    expect(parsed.score.grade).toBe("A");
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("exits with code 0 for A/B, 1 for C/D, 2 for F", async () => {
    const mockEmailCheck = await import("@wraps/email-check");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    // Grade A → exit 0
    vi.spyOn(mockEmailCheck, "runEmailCheck").mockResolvedValue(
      mockResult({
        score: {
          baseScore: 100,
          finalScore: 95,
          grade: "A",
          deductions: [],
          bonuses: [],
          maxDeductions: {},
        },
      })
    );
    const { runCheck } = await import("../commands/check.js");
    await runCheck("example.com", { json: true });
    expect(mockExit).toHaveBeenCalledWith(0);

    // Grade D → exit 1
    vi.spyOn(mockEmailCheck, "runEmailCheck").mockResolvedValue(
      mockResult({
        score: {
          baseScore: 100,
          finalScore: 55,
          grade: "D",
          deductions: [],
          bonuses: [],
          maxDeductions: {},
        },
      })
    );
    await runCheck("example.com", { json: true });
    expect(mockExit).toHaveBeenCalledWith(1);

    // Grade F → exit 2
    vi.spyOn(mockEmailCheck, "runEmailCheck").mockResolvedValue(
      mockResult({
        score: {
          baseScore: 100,
          finalScore: 20,
          grade: "F",
          deductions: [],
          bonuses: [],
          maxDeductions: {},
        },
      })
    );
    await runCheck("example.com", { json: true });
    expect(mockExit).toHaveBeenCalledWith(2);
  });
});
