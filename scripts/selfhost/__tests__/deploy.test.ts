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
const mockWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockReadFile = vi.hoisted(() =>
  vi.fn().mockResolvedValue(
    JSON.stringify({
      SelfhostApi: { url: "https://api.selfhost.example.com" },
      SelfhostWeb: { url: "https://web.selfhost.example.com" },
    })
  )
);
const mockAccess = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockChmod = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("node:fs/promises", () => ({
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  access: mockAccess,
  chmod: mockChmod,
}));

// ── clack mock ───────────────────────────────────────────────────────────────
const mockConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(false));
const mockText = vi.hoisted(() => vi.fn().mockResolvedValue(""));
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  step: vi.fn(),
}));
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  confirm: mockConfirm,
  text: mockText,
  password: vi.fn().mockResolvedValue(""),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  spinner: vi
    .fn()
    .mockReturnValue({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
  log: mockLog,
}));

// ── AWS mock ─────────────────────────────────────────────────────────────────
vi.mock("../../../packages/cli/src/utils/shared/aws.js", () => ({
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    userId: "AIDATEST",
    arn: "arn:aws:iam::123456789012:user/test",
  }),
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
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
    buildEmailStackConfig: vi.fn().mockReturnValue({
      provider: "other",
      region: "us-east-1",
      emailConfig: { domain: "example.com" },
      webhook: {
        awsAccountNumber: "123456789012",
        webhookSecret: "existing-secret",
        webhookUrl: "https://api.selfhost.example.com/v1/ses-events",
      },
    }),
  };
});

// ── pulumi mock ───────────────────────────────────────────────────────────────
const mockStackUp = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockStackRefresh = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockStackSetConfig = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
const mockExportStack = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ deployment: { resources: [] } })
);
vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      createOrSelectStack: vi.fn().mockResolvedValue({
        up: mockStackUp,
        refresh: mockStackRefresh,
        setConfig: mockStackSetConfig,
        exportStack: mockExportStack,
        workspace: { selectStack: vi.fn().mockResolvedValue(undefined) },
      }),
    },
  },
}));

vi.mock("../../../packages/cli/src/utils/shared/fs.js", () => ({
  ensurePulumiWorkDir: vi.fn().mockResolvedValue(undefined),
  getPulumiWorkDir: vi.fn().mockReturnValue("/mock/.wraps/pulumi"),
}));

vi.mock("../../../packages/cli/src/infrastructure/email-stack.js", () => ({
  deployEmailStack: vi
    .fn()
    .mockResolvedValue({ roleArn: "arn:aws:iam::...", region: "us-east-1" }),
}));

import * as pulumi from "@pulumi/pulumi";
// ── import after mocks ────────────────────────────────────────────────────────
import * as metadataModule from "../../../packages/cli/src/utils/shared/metadata.js";

const BASE_METADATA = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2026-05-01T00:00:00.000Z",
  services: {},
};

describe("scripts/selfhost/deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRunSubprocess.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        SelfhostApi: { url: "https://api.selfhost.example.com" },
        SelfhostWeb: { url: "https://web.selfhost.example.com" },
      })
    );
    // Default: .env.selfhost does NOT exist (access rejects) → deploy can proceed
    mockAccess.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );

    mockConfirm.mockResolvedValue(false);
    mockText.mockResolvedValue("");

    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue(null);
    vi.mocked(metadataModule.saveConnectionMetadata).mockResolvedValue(
      undefined
    );
  });

  it("writes .env.selfhost with generated BETTER_AUTH_SECRET and UNSUBSCRIBE_SECRET", async () => {
    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    const [, content] =
      mockWriteFile.mock.calls.find(([path]) =>
        String(path).includes(".env.selfhost")
      ) ?? [];
    expect(content).toBeDefined();
    expect(String(content)).toMatch(/BETTER_AUTH_SECRET=[a-f0-9]{64}/);
    expect(String(content)).toMatch(/UNSUBSCRIBE_SECRET=[a-f0-9]{64}/);
    expect(String(content)).toMatch(
      /DATABASE_URL=postgres:\/\/user:pass@host\/db/
    );
    expect(String(content)).toMatch(/LICENSE_KEY=wraps_lic_test/);
  });

  it("writes NEXT_PUBLIC_APP_URL and WRAPS_API_URL to .env.selfhost after deploy", async () => {
    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    const lastWriteContent = mockWriteFile.mock.calls
      .filter(([path]) => String(path).includes(".env.selfhost"))
      .at(-1)?.[1] as string | undefined;
    expect(lastWriteContent).toBeDefined();
    expect(String(lastWriteContent)).toMatch(
      /NEXT_PUBLIC_APP_URL=https:\/\/web\.selfhost\.example\.com/
    );
    expect(String(lastWriteContent)).toMatch(
      /WRAPS_API_URL=https:\/\/api\.selfhost\.example\.com/
    );
  });

  it("runs sst bootstrap then sst deploy, with .env.selfhost written before bootstrap", async () => {
    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    const calls = mockRunSubprocess.mock.calls as [string, string[]][];
    const bootstrapIdx = calls.findIndex(([, args]) =>
      args.includes("bootstrap")
    );
    const deployIdx = calls.findIndex(([, args]) => args.includes("deploy"));
    expect(bootstrapIdx).toBeGreaterThanOrEqual(0);
    expect(deployIdx).toBeGreaterThanOrEqual(0);

    const writeCallOrder = mockWriteFile.mock.invocationCallOrder[0]!;
    const bootstrapCallOrder =
      mockRunSubprocess.mock.invocationCallOrder[bootstrapIdx]!;
    expect(writeCallOrder).toBeLessThan(bootstrapCallOrder);
  });

  it("throws with a clear error when sst deploy subprocess exits non-zero", async () => {
    let callCount = 0;
    mockRunSubprocess.mockImplementation(
      async (_cmd: string, args: string[]) => {
        callCount++;
        if (args.includes("deploy")) {
          throw new Error("sst deploy failed with exit code 1");
        }
      }
    );

    const { deploy } = await import("../deploy.js");
    await expect(
      deploy({
        databaseUrl: "postgres://user:pass@host/db",
        licenseKey: "wraps_lic_test",
        region: "us-east-1",
      })
    ).rejects.toThrow(/deploy.*failed|failed.*deploy/i);
  });

  it("exits with error when SST outputs produce an empty apiUrl", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({})); // no known output keys

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { deploy } = await import("../deploy.js");
    await expect(
      deploy({
        databaseUrl: "postgres://user:pass@host/db",
        licenseKey: "wraps_lic_test",
        region: "us-east-1",
      })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("prompts to reroute email events when email service has webhookSecret", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue({
      ...BASE_METADATA,
      services: {
        email: {
          deployedAt: "2026-05-01T00:00:00.000Z",
          config: { domain: "example.com" } as never,
          webhookSecret: "existing-secret",
        },
      },
    } as never);

    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/reroute|selfhost/i),
      })
    );
  });

  it("redeploys email Pulumi stack with selfhost apiUrl as webhookUrl when user confirms", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue({
      ...BASE_METADATA,
      services: {
        email: {
          deployedAt: "2026-05-01T00:00:00.000Z",
          config: { domain: "example.com" } as never,
          webhookSecret: "existing-secret",
        },
      },
    } as never);
    mockConfirm.mockResolvedValue(true);

    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    expect(metadataModule.buildEmailStackConfig).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({
        webhook: expect.objectContaining({
          webhookUrl: expect.stringContaining("api.selfhost.example.com"),
        }),
      })
    );
    expect(
      pulumi.automation.LocalWorkspace.createOrSelectStack
    ).toHaveBeenCalled();
  });

  it("skips email reroute prompt when no email service in metadata", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue({
      ...BASE_METADATA,
      services: {},
    } as never);

    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    expect(mockConfirm).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/reroute/i),
      })
    );
  });

  it("saves selfhost service to new metadata when no prior metadata exists", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue(null);

    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

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

  it("exits with error when .env.selfhost already exists", async () => {
    mockAccess.mockResolvedValue(undefined); // file exists

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { deploy } = await import("../deploy.js");
    await expect(
      deploy({
        databaseUrl: "postgres://user:pass@host/db",
        licenseKey: "wraps_lic_test",
        region: "us-east-1",
      })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
