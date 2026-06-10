import { beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";

vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      selectStack: vi.fn(),
    },
  },
}));

vi.mock("@clack/prompts");
vi.mock("../../utils/shared/aws.js");
vi.mock("../../utils/shared/fs.js");
vi.mock("../../utils/shared/pulumi.js", () => ({
  ensurePulumiInstalled: vi.fn().mockResolvedValue(false),
  withLockRetry: vi.fn().mockImplementation((fn) => fn()),
}));
vi.mock("../../utils/shared/timeout.js", () => ({
  withTimeout: vi.fn().mockImplementation((promise) => promise),
  DEFAULT_PULUMI_TIMEOUT_MS: 300_000,
}));
vi.mock("../../utils/shared/metadata.js", async () => {
  const actual = await vi.importActual("../../utils/shared/metadata.js");
  return {
    ...actual,
    loadConnectionMetadata: vi.fn(),
    saveConnectionMetadata: vi.fn(),
  };
});

import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "../../utils/shared/aws.js";
import * as fsUtils from "../../utils/shared/fs.js";
import * as metadata from "../../utils/shared/metadata.js";
import * as pulumiUtils from "../../utils/shared/pulumi.js";
import * as timeoutUtils from "../../utils/shared/timeout.js";

const MOCK_METADATA = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2026-05-29T00:00:00.000Z",
  services: {
    selfhost: {
      deployedAt: "2026-05-01T00:00:00.000Z",
      pulumiStackName: "wraps-selfhost-123456789012-us-east-1",
      apiUrl: "https://abc123.lambda-url.us-east-1.on.aws",
      config: {
        databaseUrl: "postgres://user:pass@host/db",
        licenseKey: "wraps_lic_test",
        appUrl: "https://app.example.com",
        unsubscribeSecret: "secret1",
        betterAuthSecret: "secret2",
      },
    },
  },
};

describe("selfhostDestroy", () => {
  let mockSpinner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    message: ReturnType<typeof vi.fn>;
  };
  let mockStack: {
    refresh: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    workspace: { removeStack: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    setJsonMode(false);

    mockSpinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };
    mockStack = {
      refresh: vi.fn().mockResolvedValue({}),
      destroy: vi.fn().mockResolvedValue({}),
      workspace: { removeStack: vi.fn().mockResolvedValue(undefined) },
    };

    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.mocked(clack.note).mockImplementation(() => {});
    vi.mocked(clack.log).info = vi.fn();
    vi.mocked(clack.log).success = vi.fn();
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.log).warn = vi.fn();
    vi.mocked(clack.log).step = vi.fn();
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.confirm).mockResolvedValue(true as never);

    vi.mocked(aws.validateAWSCredentials).mockResolvedValue({
      accountId: "123456789012",
      userId: "AIDATEST",
      arn: "arn:aws:iam::123456789012:user/test",
    } as any);

    vi.mocked(fsUtils.ensurePulumiWorkDir).mockResolvedValue(undefined as any);
    vi.mocked(fsUtils.getPulumiWorkDir).mockReturnValue("/mock/.wraps/pulumi");

    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      structuredClone(MOCK_METADATA) as any
    );
    vi.mocked(metadata.saveConnectionMetadata).mockResolvedValue(undefined);

    vi.mocked(pulumi.automation.LocalWorkspace.selectStack).mockResolvedValue(
      mockStack as any
    );
  });

  it("calls stack.destroy() after user confirms", async () => {
    const { selfhostDestroy } = await import("../selfhost/destroy.js");

    await selfhostDestroy({ region: "us-east-1", yes: true });

    expect(mockStack.destroy).toHaveBeenCalledOnce();
  });

  it("ensures Pulumi CLI is installed before destroying", async () => {
    const { selfhostDestroy } = await import("../selfhost/destroy.js");

    await selfhostDestroy({ region: "us-east-1", yes: true });

    const ensureOrder = vi.mocked(pulumiUtils.ensurePulumiInstalled).mock
      .invocationCallOrder[0]!;
    const destroyOrder = mockStack.destroy.mock.invocationCallOrder[0]!;
    expect(ensureOrder).toBeLessThan(destroyOrder);
  });

  it("removes services.selfhost from metadata after successful destroy", async () => {
    const { selfhostDestroy } = await import("../selfhost/destroy.js");

    await selfhostDestroy({ region: "us-east-1", yes: true });

    expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        services: expect.not.objectContaining({ selfhost: expect.anything() }),
      })
    );
  });

  it("calls stack.refresh() before stack.destroy()", async () => {
    const { selfhostDestroy } = await import("../selfhost/destroy.js");
    await selfhostDestroy({ region: "us-east-1", yes: true });

    const refreshOrder = mockStack.refresh.mock.invocationCallOrder[0]!;
    const destroyOrder = mockStack.destroy.mock.invocationCallOrder[0]!;
    expect(refreshOrder).toBeLessThan(destroyOrder);
  });

  it("passes destroy through withLockRetry and withTimeout", async () => {
    const { selfhostDestroy } = await import("../selfhost/destroy.js");
    await selfhostDestroy({ region: "us-east-1", yes: true });

    expect(pulumiUtils.withLockRetry).toHaveBeenCalledOnce();
    expect(timeoutUtils.withTimeout).toHaveBeenCalledOnce();
  });

  it("exits early when selfhost was deployed via SST (no pulumiStackName)", async () => {
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
      ...MOCK_METADATA,
      services: {
        selfhost: {
          ...MOCK_METADATA.services.selfhost,
          pulumiStackName: undefined,
        },
      },
    } as any);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { selfhostDestroy } = await import("../selfhost/destroy.js");

    await expect(
      selfhostDestroy({ region: "us-east-1", yes: true })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockStack.destroy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("exits early when no selfhost deployment found in metadata", async () => {
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
      ...MOCK_METADATA,
      services: {},
    } as any);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { selfhostDestroy } = await import("../selfhost/destroy.js");

    await expect(
      selfhostDestroy({ region: "us-east-1", yes: true })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockStack.destroy).not.toHaveBeenCalled();
    // No deployment means no Pulumi work — don't trigger an auto-install.
    expect(pulumiUtils.ensurePulumiInstalled).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
