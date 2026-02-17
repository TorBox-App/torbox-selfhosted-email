import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { check } from "../email/check";
import { setJsonMode } from "../../utils/shared/json-output";

const sesClientMock = mockClient(SESv2Client);

// Mock process.exit
const mockExit = vi
  .spyOn(process, "exit")
  .mockImplementation((() => {}) as never);

// Mock console.log for JSON output testing
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

// Mock @clack/prompts
vi.mock("@clack/prompts");

// Mock telemetry
vi.mock("../../telemetry/events", () => ({
  trackCommand: vi.fn(),
}));

// Mock metadata
vi.mock("../../utils/shared/metadata", () => ({
  listConnections: vi.fn().mockResolvedValue([]),
}));

// Create a mock email check result factory
function createMockResult(
  overrides: Partial<{
    grade: string;
    finalScore: number;
    domain: string;
    duration: number;
  }> = {}
) {
  return {
    domain: overrides.domain ?? "example.com",
    duration: overrides.duration ?? 500,
    score: {
      grade: overrides.grade ?? "A",
      finalScore: overrides.finalScore ?? 95,
      deductions: [],
    },
    spf: {
      exists: true,
      valid: true,
      record: "v=spf1 include:amazonses.com ~all",
      lookupCount: 3,
      lookupTree: [],
      allMechanism: "-all",
    },
    dkim: {
      found: true,
      selectors: [
        {
          selector: "selector1",
          valid: true,
          revoked: false,
          keyType: "rsa",
          keyBits: 2048,
        },
      ],
      selectorsChecked: 5,
      warnings: [],
    },
    dmarc: {
      exists: true,
      valid: true,
      record: "v=DMARC1; p=reject;",
      policy: "reject",
      reportingEnabled: true,
      alignmentSpf: "r",
      alignmentDkim: "r",
      errors: [],
    },
    mx: {
      exists: true,
      records: [{ exchange: "mail.example.com", priority: 10, resolves: true }],
    },
    blacklist: {
      domainChecks: {
        checked: 5,
        listed: [],
        clean: ["bl1", "bl2", "bl3", "bl4", "bl5"],
      },
      ipChecks: { checked: 3, listed: [], clean: ["ipbl1", "ipbl2", "ipbl3"] },
    },
    mxTls: { checked: false, skipped: true, skipReason: "test", servers: [] },
    reverseDns: { results: [], allHavePtr: true, allConfirm: true },
    ipv6: { mxHasIpv6: false, spfIncludesIpv6: false },
    dnssec: { enabled: false, valid: false },
    caa: { configured: false, allowedIssuers: [] },
    mtaSts: { configured: false, policy: null },
    tlsRpt: { configured: false },
    domainAge: {
      source: "unavailable",
      ageInDays: null,
      createdAt: null,
      errors: ["Unknown"],
    },
  };
}

// Mock @wraps/email-check
vi.mock("@wraps/email-check", () => ({
  runEmailCheck: vi.fn(),
  formatSpfLookupTree: vi.fn().mockReturnValue("SPF tree"),
  getExitCode: vi.fn((grade: string) => {
    if (grade === "A" || grade === "B") {
      return 0;
    }
    if (grade === "C") {
      return 1;
    }
    if (grade === "D") {
      return 2;
    }
    return 3;
  }),
}));

// Create comprehensive mock result with all variations
function createDetailedMockResult(scenario: string) {
  const baseResult = createMockResult();

  switch (scenario) {
    case "spf-softfail":
      return {
        ...baseResult,
        spf: {
          ...baseResult.spf,
          allMechanism: "~all",
        },
      };
    case "spf-missing":
      return {
        ...baseResult,
        spf: {
          exists: false,
          valid: false,
          record: null,
          lookupCount: 0,
          lookupTree: [],
          allMechanism: null,
        },
      };
    case "spf-with-tree":
      return {
        ...baseResult,
        spf: {
          ...baseResult.spf,
          lookupTree: [{ mechanism: "include:test.com", lookups: 1 }],
        },
      };
    case "dkim-missing":
      return {
        ...baseResult,
        dkim: {
          found: false,
          selectors: [],
          selectorsChecked: 10,
          warnings: ["Consider configuring DKIM"],
        },
      };
    case "dkim-revoked":
      return {
        ...baseResult,
        dkim: {
          found: true,
          selectors: [{ selector: "old", valid: false, revoked: true }],
          selectorsChecked: 5,
          warnings: [],
        },
      };
    case "dkim-multiple":
      return {
        ...baseResult,
        dkim: {
          found: true,
          selectors: [
            {
              selector: "s1",
              valid: true,
              revoked: false,
              keyType: "rsa",
              keyBits: 2048,
            },
            {
              selector: "s2",
              valid: true,
              revoked: false,
              keyType: "ed25519",
              keyBits: null,
            },
            {
              selector: "s3",
              valid: true,
              revoked: false,
              keyType: "rsa",
              keyBits: 1024,
            },
            {
              selector: "s4",
              valid: true,
              revoked: false,
              keyType: "rsa",
              keyBits: 2048,
            },
          ],
          selectorsChecked: 10,
          warnings: [],
        },
      };
    case "dmarc-missing":
      return {
        ...baseResult,
        dmarc: {
          exists: false,
          valid: false,
          record: null,
          policy: null,
          reportingEnabled: false,
          alignmentSpf: null,
          alignmentDkim: null,
          errors: [],
        },
      };
    case "dmarc-invalid":
      return {
        ...baseResult,
        dmarc: {
          exists: true,
          valid: false,
          record: "v=DMARC1; p=invalid",
          policy: "invalid",
          reportingEnabled: false,
          alignmentSpf: "r",
          alignmentDkim: "r",
          errors: ["Invalid policy value"],
        },
      };
    case "mx-missing":
      return {
        ...baseResult,
        mx: {
          exists: false,
          records: [],
        },
      };
    case "mx-not-resolving":
      return {
        ...baseResult,
        mx: {
          exists: true,
          records: [
            { exchange: "mail1.example.com", priority: 10, resolves: true },
            { exchange: "mail2.example.com", priority: 20, resolves: false },
          ],
        },
      };
    case "mxtls-checked":
      return {
        ...baseResult,
        mxTls: {
          checked: true,
          skipped: false,
          skipReason: null,
          servers: [
            {
              host: "mail.example.com",
              connected: true,
              supportsStarttls: true,
              preferredTlsVersion: "TLSv1.3",
            },
          ],
        },
      };
    case "mxtls-no-starttls":
      return {
        ...baseResult,
        mxTls: {
          checked: true,
          skipped: false,
          skipReason: null,
          servers: [
            {
              host: "mail.example.com",
              connected: true,
              supportsStarttls: false,
            },
          ],
        },
      };
    case "mxtls-timeout":
      return {
        ...baseResult,
        mxTls: {
          checked: true,
          skipped: false,
          skipReason: null,
          servers: [
            {
              host: "mail.example.com",
              connected: false,
              connectionError: "Connection timed out",
            },
          ],
        },
      };
    case "mxtls-not-checked":
      return {
        ...baseResult,
        mxTls: {
          checked: false,
          skipped: false,
          skipReason: null,
          servers: [],
        },
      };
    case "reversedns-missing":
      return {
        ...baseResult,
        reverseDns: {
          results: [{ ip: "1.2.3.4", hasPtr: false, confirms: false }],
          allHavePtr: false,
          allConfirm: false,
        },
      };
    case "reversedns-partial":
      return {
        ...baseResult,
        reverseDns: {
          results: [{ ip: "1.2.3.4", hasPtr: true, confirms: false }],
          allHavePtr: true,
          allConfirm: false,
        },
      };
    case "ipv6-full":
      return {
        ...baseResult,
        ipv6: { mxHasIpv6: true, spfIncludesIpv6: true },
      };
    case "ipv6-partial":
      return {
        ...baseResult,
        ipv6: { mxHasIpv6: true, spfIncludesIpv6: false },
      };
    case "blacklisted":
      return {
        ...baseResult,
        blacklist: {
          domainChecks: {
            checked: 5,
            listed: [{ blacklist: "spamhaus", meaning: "Listed for spam" }],
            clean: ["bl2", "bl3", "bl4", "bl5"],
          },
          ipChecks: {
            checked: 3,
            listed: [],
            clean: ["ipbl1", "ipbl2", "ipbl3"],
          },
        },
      };
    case "security-features":
      return {
        ...baseResult,
        dnssec: { enabled: true, valid: true },
        caa: { configured: true, allowedIssuers: ["letsencrypt.org"] },
        mtaSts: { configured: true, policy: { mode: "enforce" } },
        tlsRpt: { configured: true },
      };
    case "dnssec-broken":
      return {
        ...baseResult,
        dnssec: { enabled: true, valid: false },
        caa: { configured: false, allowedIssuers: [] },
        mtaSts: { configured: true, policy: { mode: "testing" } },
        tlsRpt: { configured: false },
      };
    case "domain-age-new":
      return {
        ...baseResult,
        domainAge: {
          source: "whois",
          ageInDays: 15,
          createdAt: "2024-01-01T00:00:00Z",
          errors: [],
        },
      };
    case "domain-age-old":
      return {
        ...baseResult,
        domainAge: {
          source: "whois",
          ageInDays: 1000,
          createdAt: "2021-01-01T00:00:00Z",
          errors: [],
        },
      };
    case "with-deductions":
      return {
        ...baseResult,
        score: {
          grade: "D",
          finalScore: 45,
          deductions: [
            { check: "spf", reason: "SPF not configured", points: 25 },
            { check: "dkim", reason: "DKIM not found", points: 25 },
            { check: "dmarc", reason: "DMARC policy is none", points: 10 },
          ],
        },
      };
    case "grade-b":
      return {
        ...baseResult,
        score: { grade: "B", finalScore: 85, deductions: [] },
      };
    case "grade-c":
      return {
        ...baseResult,
        score: { grade: "C", finalScore: 70, deductions: [] },
      };
    default:
      return baseResult;
  }
}

describe("Email Check Command", () => {
  let mockSpinner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    sesClientMock.reset();
    vi.clearAllMocks();
    mockExit.mockClear();
    mockConsoleLog.mockClear();
    setJsonMode(false);

    // Mock spinner
    mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
    };

    const clack = await import("@clack/prompts");
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.log).info = vi.fn();
    vi.mocked(clack.log).warn = vi.fn();
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
  });

  describe("domain input", () => {
    it("should use domain from options when provided", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com" });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.any(Object)
      );
    });

    it("should prompt for domain when not provided", async () => {
      const clack = await import("@clack/prompts");
      vi.mocked(clack.text).mockResolvedValue("prompted.com" as never);

      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createMockResult({ domain: "prompted.com" })
      );

      await check({});

      expect(clack.text).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Enter domain to check:",
        })
      );
      expect(runEmailCheck).toHaveBeenCalledWith(
        "prompted.com",
        expect.any(Object)
      );
    });

    it("should exit when user cancels domain prompt", async () => {
      const clack = await import("@clack/prompts");
      const cancelSymbol = Symbol("cancel");
      vi.mocked(clack.text).mockResolvedValue(cancelSymbol as never);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      await check({});

      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled");
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe("output modes", () => {
    it("should output JSON when --json flag is set", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      const mockResult = createMockResult({ domain: "json-test.com" });
      vi.mocked(runEmailCheck).mockResolvedValue(mockResult);

      setJsonMode(true);
      await check({ domain: "json-test.com", json: true });
      setJsonMode(false);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          command: "email.check",
          data: mockResult,
        })
      );
    });

    it("should show spinner for non-JSON output", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com" });

      expect(mockSpinner.start).toHaveBeenCalledWith(
        expect.stringContaining("test.com")
      );
      expect(mockSpinner.stop).toHaveBeenCalled();
    });

    it("should not show spinner for JSON output", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      setJsonMode(true);
      await check({ domain: "test.com", json: true });
      setJsonMode(false);

      expect(mockSpinner.start).not.toHaveBeenCalled();
    });
  });

  describe("check options", () => {
    it("should pass quick option to runEmailCheck", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com", quick: true });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({ quick: true })
      );
    });

    it("should pass verbose option to runEmailCheck", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com", verbose: true });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({ verbose: true })
      );
    });

    it("should pass dkimSelector option to runEmailCheck", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com", dkimSelector: "custom-selector" });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({ dkimSelector: "custom-selector" })
      );
    });

    it("should pass skipBlacklists option to runEmailCheck", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com", skipBlacklists: true });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({ skipBlacklists: true })
      );
    });

    it("should pass skipTls option to runEmailCheck", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com", skipTls: true });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({ skipTls: true })
      );
    });

    it("should pass timeout option to runEmailCheck", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com", timeout: 5000 });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({ timeout: 5000 })
      );
    });
  });

  describe("exit codes", () => {
    it("should exit with 0 for grade A", async () => {
      const { runEmailCheck, getExitCode } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createMockResult({ grade: "A", finalScore: 95 })
      );
      vi.mocked(getExitCode).mockReturnValue(0);

      await check({ domain: "test.com" });

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should exit with 0 for grade B", async () => {
      const { runEmailCheck, getExitCode } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createMockResult({ grade: "B", finalScore: 85 })
      );
      vi.mocked(getExitCode).mockReturnValue(0);

      await check({ domain: "test.com" });

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should exit with 1 for grade C", async () => {
      const { runEmailCheck, getExitCode } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createMockResult({ grade: "C", finalScore: 70 })
      );
      vi.mocked(getExitCode).mockReturnValue(1);

      await check({ domain: "test.com" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should exit with 2 for grade D", async () => {
      const { runEmailCheck, getExitCode } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createMockResult({ grade: "D", finalScore: 50 })
      );
      vi.mocked(getExitCode).mockReturnValue(2);

      await check({ domain: "test.com" });

      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it("should exit with 3 for grade F", async () => {
      const { runEmailCheck, getExitCode } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createMockResult({ grade: "F", finalScore: 30 })
      );
      vi.mocked(getExitCode).mockReturnValue(3);

      await check({ domain: "test.com" });

      expect(mockExit).toHaveBeenCalledWith(3);
    });
  });

  describe("error handling", () => {
    it("should handle runEmailCheck errors gracefully", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockRejectedValue(
        new Error("DNS lookup failed")
      );

      await check({ domain: "test.com" });

      expect(mockSpinner.stop).toHaveBeenCalledWith("Check failed");
      expect(mockExit).toHaveBeenCalledWith(4);
    });

    it("should output error as JSON when --json flag is set", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockRejectedValue(new Error("Network error"));

      setJsonMode(true);
      await check({ domain: "test.com", json: true });
      setJsonMode(false);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          command: "email.check",
          error: { code: "CHECK_FAILED", message: "Network error" },
        })
      );
      expect(mockExit).toHaveBeenCalledWith(4);
    });

    it("should log error with clack for non-JSON output", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockRejectedValue(
        new Error("Check failed error")
      );

      const clack = await import("@clack/prompts");

      await check({ domain: "test.com" });

      expect(clack.log.error).toHaveBeenCalledWith("Check failed error");
    });
  });

  describe("SES DKIM token integration", () => {
    it("should use SES DKIM tokens when connections exist", async () => {
      const { listConnections } = await import("../../utils/shared/metadata");
      vi.mocked(listConnections).mockResolvedValue([
        { accountId: "123", region: "us-east-1" },
      ] as never);

      sesClientMock.on(GetEmailIdentityCommand).resolves({
        DkimAttributes: {
          Tokens: ["ses-token-1", "ses-token-2", "ses-token-3"],
        },
      });

      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com" });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({
          dkimSelectors: ["ses-token-1", "ses-token-2", "ses-token-3"],
        })
      );
    });

    it("should use custom dkimSelector when provided", async () => {
      const { listConnections } = await import("../../utils/shared/metadata");
      vi.mocked(listConnections).mockResolvedValue([
        { accountId: "123", region: "us-east-1" },
      ] as never);

      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      // When dkimSelector is provided, SES tokens should not be fetched
      await check({ domain: "test.com", dkimSelector: "custom" });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({
          dkimSelector: "custom",
        })
      );
    });

    it("should gracefully handle SES errors when fetching DKIM tokens", async () => {
      const { listConnections } = await import("../../utils/shared/metadata");
      vi.mocked(listConnections).mockResolvedValue([
        { accountId: "123", region: "us-east-1" },
      ] as never);

      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejects(new Error("Access denied"));

      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      // Should still work, just without SES tokens
      await check({ domain: "test.com" });

      expect(runEmailCheck).toHaveBeenCalledWith(
        "test.com",
        expect.objectContaining({
          dkimSelectors: undefined,
        })
      );
    });

    it("should not fetch SES tokens when no connections exist", async () => {
      const { listConnections } = await import("../../utils/shared/metadata");
      vi.mocked(listConnections).mockResolvedValue([]);

      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com" });

      // SES client should not be called
      expect(sesClientMock.commandCalls(GetEmailIdentityCommand).length).toBe(
        0
      );
    });
  });

  describe("telemetry", () => {
    it("should track successful check with grade", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createMockResult({ grade: "A", finalScore: 95 })
      );

      const { trackCommand } = await import("../../telemetry/events");

      await check({ domain: "test.com" });

      expect(trackCommand).toHaveBeenCalledWith(
        "email:check",
        expect.objectContaining({
          success: true,
          grade: "A",
        })
      );
    });

    it("should track failed check with error", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockRejectedValue(new Error("DNS error"));

      const { trackCommand } = await import("../../telemetry/events");

      await check({ domain: "test.com" });

      expect(trackCommand).toHaveBeenCalledWith(
        "email:check",
        expect.objectContaining({
          success: false,
          error: "DNS error",
        })
      );
    });
  });

  describe("display output", () => {
    it("should display SPF with softfail warning", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("spf-softfail") as never
      );

      await check({ domain: "test.com" });

      // Check that console.log was called (display functions executed)
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display missing SPF", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("spf-missing") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display SPF lookup tree in verbose mode", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("spf-with-tree") as never
      );

      await check({ domain: "test.com", verbose: true });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display missing DKIM with warnings", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("dkim-missing") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display revoked DKIM", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("dkim-revoked") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display multiple DKIM selectors (more than 3)", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("dkim-multiple") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display missing DMARC", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("dmarc-missing") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display invalid DMARC with errors", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("dmarc-invalid") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display missing MX records", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("mx-missing") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display MX with some not resolving", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("mx-not-resolving") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display MX TLS checked with support", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("mxtls-checked") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display MX TLS with missing STARTTLS", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("mxtls-no-starttls") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display MX TLS with timeout (port 25 blocked)", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("mxtls-timeout") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display MX TLS not checked", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("mxtls-not-checked") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display missing reverse DNS", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("reversedns-missing") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display partial reverse DNS", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("reversedns-partial") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display full IPv6 support", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("ipv6-full") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display partial IPv6 support", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("ipv6-partial") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display blacklist listings", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("blacklisted") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display security features (DNSSEC, CAA, MTA-STS, TLS-RPT)", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("security-features") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display broken DNSSEC and testing MTA-STS mode", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("dnssec-broken") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display new domain age with warning", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("domain-age-new") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display old domain age", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("domain-age-old") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display deductions with fix suggestions", async () => {
      const { runEmailCheck, getExitCode } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("with-deductions") as never
      );
      vi.mocked(getExitCode).mockReturnValue(2);

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display Grade B message", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("grade-b") as never
      );

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display Grade C message with help suggestion", async () => {
      const { runEmailCheck, getExitCode } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(
        createDetailedMockResult("grade-c") as never
      );
      vi.mocked(getExitCode).mockReturnValue(1);

      await check({ domain: "test.com" });

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should display quick mode indicator", async () => {
      const { runEmailCheck } = await import("@wraps/email-check");
      vi.mocked(runEmailCheck).mockResolvedValue(createMockResult());

      await check({ domain: "test.com", quick: true });

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});
