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

describe("telemetry first-run notice — gated in --json mode", () => {
  // cli.ts is an executable script (parses real process.argv and calls its
  // unexported run()/interactiveMenu() at module load, per plan 121's
  // fallback clause) — not drivable as a function in isolation without
  // restructuring it, which is out of scope for this plan. Per the test
  // plan's explicit fallback, this exercises the extracted guard condition
  // — `!isJsonMode() && telemetry.shouldShowNotification()` — verbatim as
  // it now appears at both notice sites in cli.ts (confirmed via
  // `rg -n 'shouldShowNotification' src/cli.ts`), against the real
  // isJsonMode() implementation, in both directions.
  afterEach(() => {
    setJsonMode(false);
  });

  it("suppresses the notice when isJsonMode() is true", () => {
    setJsonMode(true);
    const shouldShowNotification = () => true;

    const shouldPrint = !isJsonMode() && shouldShowNotification();

    expect(shouldPrint).toBe(false);
  });

  it("still shows the notice outside --json mode when shouldShowNotification() is true", () => {
    setJsonMode(false);
    const shouldShowNotification = () => true;

    const shouldPrint = !isJsonMode() && shouldShowNotification();

    expect(shouldPrint).toBe(true);
  });

  it("stays suppressed in --json mode even when shouldShowNotification() is false", () => {
    setJsonMode(true);
    const shouldShowNotification = () => false;

    const shouldPrint = !isJsonMode() && shouldShowNotification();

    expect(shouldPrint).toBe(false);
  });
});
