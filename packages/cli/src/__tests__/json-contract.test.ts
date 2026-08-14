import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `wraps email init --json` on an account that already has a Wraps
 * connection used to print human-formatted clack logs and exit 0 with no
 * JSON envelope at all — indistinguishable from a crash to a JSON-consuming
 * agent. Same story for the first-run telemetry notice: a bare console.log
 * block with no isJsonMode() guard, corrupting the first `--json` invocation
 * ever run outside CI.
 *
 * Mocking style modeled on `email-destroy.test.ts` — mock at the dependency
 * boundary (clack, AWS, pulumi, metadata) and drive the real command.
 */

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
}));

vi.mock("../utils/shared/aws.js", () => ({
  validateAWSCredentialsWithDetails: vi.fn().mockResolvedValue({
    identity: {
      accountId: "123456789012",
      userId: "AIDAEXAMPLE",
      arn: "arn:aws:iam::123456789012:user/test",
    },
    credentialSource: "profile",
    warnings: [],
  }),
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
  getSESAccountStatus: vi.fn().mockResolvedValue({ isSandbox: false }),
}));

vi.mock("../utils/shared/pulumi.js", async () => {
  const actual = (await vi.importActual("../utils/shared/pulumi.js")) as any;
  return {
    ensurePulumiInstalled: vi.fn().mockResolvedValue(false),
    previewWithResourceChanges: vi.fn(),
    withLockRetry: actual.withLockRetry,
  };
});

const { mockLoadConnectionMetadata } = vi.hoisted(() => ({
  mockLoadConnectionMetadata: vi.fn(),
}));
vi.mock("../utils/shared/metadata.js", () => ({
  loadConnectionMetadata: mockLoadConnectionMetadata,
  saveConnectionMetadata: vi.fn(),
  createConnectionMetadata: vi.fn(),
}));

import * as clack from "@clack/prompts";
import { init } from "../commands/email/init.js";
import { isJsonMode, setJsonMode } from "../utils/shared/json-output.js";

const EXISTING_CONNECTION = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "vercel",
  timestamp: "2024-01-01T00:00:00.000Z",
  services: {
    email: {
      preset: "production",
      config: { domain: "example.com", sendingEnabled: true },
      pulumiStackName: "wraps-123456789012-us-east-1",
      deployedAt: "2024-01-01T00:00:00.000Z",
    },
  },
};

describe("email init — already-deployed exit respects --json", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConnectionMetadata.mockResolvedValue(EXISTING_CONNECTION);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    // The real command calls process.exit(0) on this path. A no-op mock
    // would let execution fall through past it (process.exit isn't really
    // a control-flow-ending statement once mocked away), so — matching the
    // pattern in utils/__tests__/prompts.test.ts — throw instead, which
    // halts init() at the same point real process.exit would.
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    setJsonMode(false);
    consoleLogSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("emits exactly one JSON envelope and no clack output in --json mode", async () => {
    setJsonMode(true);

    await expect(
      init({ provider: "aws", region: "us-east-1", json: true })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(clack.log.warn).not.toHaveBeenCalled();
    expect(clack.log.info).not.toHaveBeenCalled();

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const line = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);

    expect(parsed).toEqual({
      success: true,
      command: "email.init",
      data: {
        alreadyDeployed: true,
        accountId: "123456789012",
        region: "us-east-1",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
  });

  it("keeps the human clack output and emits no JSON line outside --json mode", async () => {
    setJsonMode(false);

    await expect(
      init({ provider: "aws", region: "us-east-1" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Connection already exists")
    );

    for (const call of consoleLogSpy.mock.calls) {
      expect(() => JSON.parse(call[0] as string)).toThrow();
    }
  });
});

/**
 * cli.ts is an executable script — it parses real `process.argv` and calls
 * its unexported `run()`/`interactiveMenu()` at module load, so it can't be
 * imported and driven as a function in a test without restructuring it
 * (out of scope for this plan). A behavioral test that instead re-typed the
 * guard expression inline (`!isJsonMode() && (() => true)()`) would pass or
 * fail based only on the `&&` operator, not on anything in cli.ts — it
 * couldn't catch the guard being deleted. So this is a source-level
 * regression test instead, modeled on
 * `readme-resource-inventory.test.ts` (readFileSync + fileURLToPath) and
 * `dashboard-url-hardcode.test.ts` (a "no unguarded occurrence" source
 * guard): it reads cli.ts's actual text and asserts every
 * `shouldShowNotification()` call site is guarded by `isJsonMode()`, so it
 * fails if the guard is ever removed or a new, unguarded notice site is
 * added.
 */
describe("telemetry first-run notice — gated in --json mode (source guard)", () => {
  const cliPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../cli.ts"
  );
  // Collapse whitespace/newlines to single spaces so a future formatter
  // pass (different line wraps or indentation) can't produce a false
  // failure here.
  const cliSource = readFileSync(cliPath, "utf-8").replace(/\s+/g, " ");

  function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
  }

  const totalCallSites = countOccurrences(
    cliSource,
    "shouldShowNotification("
  );
  const guardedCallSites = countOccurrences(
    cliSource,
    "!isJsonMode() && telemetry.shouldShowNotification()"
  );

  it("finds shouldShowNotification() call sites to guard (guards the extraction itself)", () => {
    // If this is 0, the string search below stopped matching and every
    // assertion in this file about telemetry gating is vacuous.
    expect(totalCallSites).toBeGreaterThan(0);
  });

  it("guards every shouldShowNotification() call site with isJsonMode()", () => {
    // Derived from totalCallSites rather than hardcoded to 2, so this
    // still passes if a third notice site is added guarded, and still
    // fails if one is added unguarded.
    expect(guardedCallSites).toBe(totalCallSites);
  });

  it("has no bare, unguarded `if (telemetry.shouldShowNotification())` left", () => {
    expect(cliSource).not.toContain(
      "if (telemetry.shouldShowNotification())"
    );
  });
});
