import { beforeEach, describe, expect, it, vi } from "vitest";

// ── subprocess mock ──────────────────────────────────────────────────────────
const mockRunSubprocess = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
vi.mock("../subprocess.js", () => ({
  runSubprocess: mockRunSubprocess,
  REPO_ROOT: "/mock/repo",
}));

// ── fs mock ──────────────────────────────────────────────────────────────────
const mockRm = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("node:fs/promises", () => ({
  rm: mockRm,
}));

// ── clack mock ───────────────────────────────────────────────────────────────
const mockConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: mockConfirm,
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    step: vi.fn(),
  },
}));

// ── AWS mock ──────────────────────────────────────────────────────────────────
vi.mock("../../../packages/cli/src/utils/shared/aws.js", () => ({
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    userId: "AIDATEST",
    arn: "arn:aws:iam::123456789012:user/test",
  }),
}));

// ── metadata mock ─────────────────────────────────────────────────────────────
vi.mock("../../../packages/cli/src/utils/shared/metadata.js", async () => {
  const actual = await vi.importActual(
    "../../../packages/cli/src/utils/shared/metadata.js"
  );
  return {
    ...actual,
    loadConnectionMetadata: vi.fn().mockResolvedValue(null),
    saveConnectionMetadata: vi.fn().mockResolvedValue(undefined),
  };
});

import * as metadataModule from "../../../packages/cli/src/utils/shared/metadata.js";

const BASE_METADATA = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2026-05-01T00:00:00.000Z",
  services: {
    selfhost: {
      deployedAt: "2026-05-01T00:00:00.000Z",
      apiUrl: "https://api.selfhost.example.com",
      webUrl: "https://web.selfhost.example.com",
      config: {
        databaseUrl: "postgres://user:pass@host/db",
        licenseKey: "wraps_lic_test",
        appUrl: "https://web.selfhost.example.com",
        unsubscribeSecret: "secret1",
        betterAuthSecret: "secret2",
      },
    },
  },
};

describe("scripts/selfhost/destroy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSubprocess.mockResolvedValue(undefined);
    mockConfirm.mockResolvedValue(true);
    mockRm.mockResolvedValue(undefined);
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue(
      structuredClone(BASE_METADATA) as never
    );
    vi.mocked(metadataModule.saveConnectionMetadata).mockResolvedValue(
      undefined
    );
  });

  it("runs sst remove when user confirms", async () => {
    const { destroy } = await import("../destroy.js");
    await destroy({ region: "us-east-1", yes: true });

    const removeCall = mockRunSubprocess.mock.calls.find(([, args]) =>
      (args as string[])?.includes("remove")
    );
    expect(removeCall).toBeDefined();
  });

  it("passes --stage production to sst remove", async () => {
    const { destroy } = await import("../destroy.js");
    await destroy({ region: "us-east-1", yes: true });

    const removeCall = mockRunSubprocess.mock.calls.find(([, args]) =>
      (args as string[])?.includes("remove")
    );
    expect(removeCall?.[1]).toContain("production");
  });

  it("removes .env.selfhost after successful destroy", async () => {
    const { destroy } = await import("../destroy.js");
    await destroy({ region: "us-east-1", yes: true });

    expect(mockRm).toHaveBeenCalledWith(
      expect.stringContaining(".env.selfhost")
    );
  });

  it("clears services.selfhost from metadata after successful destroy", async () => {
    const { destroy } = await import("../destroy.js");
    await destroy({ region: "us-east-1", yes: true });

    expect(metadataModule.saveConnectionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        services: expect.not.objectContaining({ selfhost: expect.anything() }),
      })
    );
  });

  it("does not fail when .env.selfhost does not exist", async () => {
    mockRm.mockRejectedValueOnce(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );

    const { destroy } = await import("../destroy.js");
    await expect(
      destroy({ region: "us-east-1", yes: true })
    ).resolves.toBeUndefined();
  });

  it("skips metadata update when no selfhost service in metadata", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue({
      ...BASE_METADATA,
      services: {},
    } as never);

    const { destroy } = await import("../destroy.js");
    await destroy({ region: "us-east-1", yes: true });

    expect(metadataModule.saveConnectionMetadata).not.toHaveBeenCalled();
  });

  it("cancels without running sst remove when user declines", async () => {
    mockConfirm.mockResolvedValue(false);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { destroy } = await import("../destroy.js");
    await expect(destroy({ region: "us-east-1" })).rejects.toThrow(
      "process.exit called"
    );

    expect(mockRunSubprocess).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("skips confirmation prompt when --force is passed", async () => {
    const { destroy } = await import("../destroy.js");
    await destroy({ region: "us-east-1", force: true });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockRunSubprocess).toHaveBeenCalled();
  });

  it("throws with a clear error when sst remove subprocess exits non-zero", async () => {
    mockRunSubprocess.mockRejectedValueOnce(
      new Error("sst remove failed with exit code 1")
    );

    const { destroy } = await import("../destroy.js");
    await expect(destroy({ region: "us-east-1", yes: true })).rejects.toThrow(
      /remove.*failed|failed.*remove/i
    );
  });
});
