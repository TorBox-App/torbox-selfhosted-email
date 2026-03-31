import { describe, expect, it } from "vitest";
import { parseArgs } from "../parse-args.js";

describe("parseArgs", () => {
  it("returns check command with domain for `mail-audit example.com`", () => {
    const result = parseArgs(["node", "mail-audit", "example.com"]);
    expect(result.command).toBe("check");
    expect(result.domain).toBe("example.com");
    expect(result.flags.json).toBeFalsy();
    expect(result.flags.quick).toBeFalsy();
  });

  it("returns spf command with domain for `mail-audit spf example.com`", () => {
    const result = parseArgs(["node", "mail-audit", "spf", "example.com"]);
    expect(result.command).toBe("spf");
    expect(result.domain).toBe("example.com");
  });

  it("returns help command for --help flag", () => {
    const result = parseArgs(["node", "mail-audit", "--help"]);
    expect(result.command).toBe("help");
    expect(result.flags.help).toBe(true);
  });

  it("returns check with no domain when domain is missing", () => {
    const result = parseArgs(["node", "mail-audit"]);
    expect(result.command).toBe("check");
    expect(result.domain).toBeUndefined();
  });

  it("parses all flags correctly", () => {
    const result = parseArgs([
      "node",
      "mail-audit",
      "example.com",
      "--json",
      "--quick",
      "--verbose",
      "--skip-blacklists",
      "--skip-tls",
      "--timeout",
      "10000",
    ]);
    expect(result.flags.json).toBe(true);
    expect(result.flags.quick).toBe(true);
    expect(result.flags.verbose).toBe(true);
    expect(result.flags.skipBlacklists).toBe(true);
    expect(result.flags.skipTls).toBe(true);
    expect(result.flags.timeout).toBe(10_000);
  });
});
