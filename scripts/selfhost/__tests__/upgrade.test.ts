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
const mockReadFile = vi.hoisted(() =>
  vi.fn().mockResolvedValue(
    JSON.stringify({
      SelfhostApi: { url: "https://api.selfhost.example.com" },
      SelfhostWeb: { url: "https://web.selfhost.example.com" },
    })
  )
);
const mockAccess = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: mockReadFile,
  access: mockAccess,
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

// ── pg / drizzle mocks ────────────────────────────────────────────────────────
const mockMigrate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("pg", () => ({
  Pool: class MockPool {
    end = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn().mockReturnValue({}),
}));

vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: mockMigrate,
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

describe("scripts/selfhost/upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSubprocess.mockResolvedValue(undefined);
    mockConfirm.mockResolvedValue(true);
    mockMigrate.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined); // .env.selfhost exists by default
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        SelfhostApi: { url: "https://api.selfhost.example.com" },
        SelfhostWeb: { url: "https://web.selfhost.example.com" },
      })
    );
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue(
      structuredClone(BASE_METADATA) as never
    );
    vi.mocked(metadataModule.saveConnectionMetadata).mockResolvedValue(
      undefined
    );
  });

  it("runs sst deploy when .env.selfhost exists and user confirms", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    const deployCall = mockRunSubprocess.mock.calls.find(([, args]) =>
      (args as string[])?.includes("deploy")
    );
    expect(deployCall).toBeDefined();
  });

  it("does not run sst bootstrap (only deploy)", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    const bootstrapCall = mockRunSubprocess.mock.calls.find(([, args]) =>
      (args as string[])?.includes("bootstrap")
    );
    expect(bootstrapCall).toBeUndefined();
  });

  it("saves updated apiUrl and webUrl to metadata after upgrade", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(metadataModule.saveConnectionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        services: expect.objectContaining({
          selfhost: expect.objectContaining({
            apiUrl: "https://api.selfhost.example.com",
            webUrl: "https://web.selfhost.example.com",
          }),
        }),
      })
    );
  });

  it("preserves existing selfhost config fields across upgrade", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    const savedArg = vi.mocked(metadataModule.saveConnectionMetadata).mock
      .calls[0]?.[0] as never;
    expect(savedArg?.services?.selfhost?.config?.databaseUrl).toBe(
      "postgres://user:pass@host/db"
    );
    expect(savedArg?.services?.selfhost?.config?.betterAuthSecret).toBe(
      "secret2"
    );
  });

  it("exits with error when SST outputs produce an empty apiUrl", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({}));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { upgrade } = await import("../upgrade.js");
    await expect(upgrade({ region: "us-east-1", yes: true })).rejects.toThrow(
      "process.exit called"
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(metadataModule.saveConnectionMetadata).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("throws with a clear error when sst deploy subprocess exits non-zero", async () => {
    mockRunSubprocess.mockRejectedValueOnce(
      new Error("sst deploy failed with exit code 1")
    );

    const { upgrade } = await import("../upgrade.js");
    await expect(upgrade({ region: "us-east-1", yes: true })).rejects.toThrow(
      /deploy.*failed|failed.*deploy/i
    );
  });

  it("exits early with error when no selfhost deployment found in metadata", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue({
      ...BASE_METADATA,
      services: {},
    } as never);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { upgrade } = await import("../upgrade.js");
    await expect(upgrade({ region: "us-east-1", yes: true })).rejects.toThrow(
      "process.exit called"
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockRunSubprocess).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("exits early with error when .env.selfhost is missing", async () => {
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { upgrade } = await import("../upgrade.js");
    await expect(upgrade({ region: "us-east-1", yes: true })).rejects.toThrow(
      "process.exit called"
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockRunSubprocess).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("cancels without running deploy when user declines confirmation", async () => {
    mockConfirm.mockResolvedValue(false);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { upgrade } = await import("../upgrade.js");
    await expect(upgrade({ region: "us-east-1" })).rejects.toThrow(
      "process.exit called"
    );

    expect(mockRunSubprocess).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
