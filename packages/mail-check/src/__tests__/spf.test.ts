import type { SpfResult } from "@wraps.dev/email-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function mockSpfResult(overrides: Partial<SpfResult> = {}): SpfResult {
  return {
    exists: true,
    record: "v=spf1 include:_spf.google.com include:amazonses.com -all",
    records: ["v=spf1 include:_spf.google.com include:amazonses.com -all"],
    multipleRecords: false,
    valid: true,
    syntaxErrors: [],
    warnings: [],
    lookupCount: 2,
    lookupLimit: 10,
    lookupTree: [
      {
        mechanism: "include:_spf.google.com",
        type: "include",
        domain: "_spf.google.com",
        lookups: 1,
        children: [],
        error: null,
      },
      {
        mechanism: "include:amazonses.com",
        type: "include",
        domain: "amazonses.com",
        lookups: 1,
        children: [],
        error: null,
      },
    ],
    allMechanism: "-all",
    includes: ["_spf.google.com", "amazonses.com"],
    hasPtr: false,
    hasDuplicates: false,
    hasCircularInclude: false,
    recordLength: 58,
    usesMacros: false,
    macros: [],
    ...overrides,
  };
}

describe("runSpfCheck", () => {
  it("displays SPF record and lookup count for valid domain", async () => {
    const emailCheck = await import("@wraps.dev/email-check");
    vi.spyOn(emailCheck, "checkSpf").mockResolvedValue(mockSpfResult());
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    const { runSpfCheck } = await import("../commands/spf.js");
    await runSpfCheck("example.com", {});

    const text = output.join("\n");
    expect(text).toContain("v=spf1");
    expect(text).toContain("2/10");
  });

  it("shows lookup tree when lookups > 0", async () => {
    const emailCheck = await import("@wraps.dev/email-check");
    vi.spyOn(emailCheck, "checkSpf").mockResolvedValue(mockSpfResult());
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const { runSpfCheck } = await import("../commands/spf.js");
    await runSpfCheck("example.com", {});

    const text = output.join("\n");
    expect(text).toContain("_spf.google.com");
    expect(text).toContain("amazonses.com");
  });

  it("detects and displays provider names from SPF includes", async () => {
    const emailCheck = await import("@wraps.dev/email-check");
    vi.spyOn(emailCheck, "checkSpf").mockResolvedValue(mockSpfResult());
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const { runSpfCheck } = await import("../commands/spf.js");
    await runSpfCheck("example.com", {});

    const text = output.join("\n");
    expect(text).toContain("Google Workspace");
    expect(text).toContain("AWS SES");
  });

  it("with --json outputs valid JSON with SPF result", async () => {
    const emailCheck = await import("@wraps.dev/email-check");
    vi.spyOn(emailCheck, "checkSpf").mockResolvedValue(mockSpfResult());
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const { runSpfCheck } = await import("../commands/spf.js");
    await runSpfCheck("example.com", { json: true });

    const text = output.join("\n");
    const parsed = JSON.parse(text);
    expect(parsed.domain).toBe("example.com");
    expect(parsed.spf.exists).toBe(true);
    expect(parsed.spf.lookupCount).toBe(2);
  });

  it("shows 'No SPF record found' for domain without SPF", async () => {
    const emailCheck = await import("@wraps.dev/email-check");
    vi.spyOn(emailCheck, "checkSpf").mockResolvedValue(
      mockSpfResult({
        exists: false,
        record: null,
        records: [],
        valid: false,
        lookupCount: 0,
        lookupTree: [],
        allMechanism: null,
        includes: [],
      })
    );
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const { runSpfCheck } = await import("../commands/spf.js");
    await runSpfCheck("nospf.example.com", {});

    const text = output.join("\n");
    expect(text).toContain("No SPF record found");
  });
});
