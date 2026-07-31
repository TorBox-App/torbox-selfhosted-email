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

// ── existing-deployment probe mock (never hit real AWS from unit tests) ──────
const mockHasExisting = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock(
  "../../../packages/cli/src/utils/selfhost/existing-deployment.js",
  () => ({
    hasExistingSelfhostResources: mockHasExisting,
  })
);

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

// ── pg / drizzle mocks ────────────────────────────────────────────────────────
const mockMigrate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockPoolEnd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("pg", () => ({
  Pool: class MockPool {
    end = mockPoolEnd;
  },
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn().mockReturnValue({}),
}));

vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: mockMigrate,
}));

// Unmocked, this reaches SESv2 for real and every test in the file times out.
const mockProvisionTemplates = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("../templates.js", () => ({
  provisionTemplatesWithProgress: mockProvisionTemplates,
}));

// detectEmailStack makes three live AWS calls (GetRole + two SES lists). They
// were never stubbed here — the try/catch just swallowed the failures — so the
// file's runtime tracked real network latency and adding the third probe tipped
// it past the 5s timeout. resolveAuthEmailFrom stays real: buildDeployedEnvVars
// derives AUTH_EMAIL_FROM through it.
vi.mock("../../../packages/cli/src/utils/selfhost/email-stack.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../packages/cli/src/utils/selfhost/email-stack.js")
  >("../../../packages/cli/src/utils/selfhost/email-stack.js");
  return {
    ...actual,
    detectEmailStack: vi.fn().mockResolvedValue({
      roleArn: null,
      configSetName: null,
      verifiedDomains: [],
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

const mockEnsurePulumiInstalled = vi.hoisted(() =>
  vi.fn().mockResolvedValue(false)
);
vi.mock("../../../packages/cli/src/utils/shared/pulumi.js", () => ({
  ensurePulumiInstalled: mockEnsurePulumiInstalled,
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
    mockHasExisting.mockResolvedValue(false);
    mockMigrate.mockResolvedValue(undefined);
    mockEnsurePulumiInstalled.mockResolvedValue(false);

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

  it("strips the Lambda Function URL's trailing slash from WRAPS_API_URL and metadata", async () => {
    // What SST actually emits for `url: true` — AWS Function URLs always carry
    // the trailing slash. Stored raw, every appended path doubles the slash
    // (`…on.aws//webhooks/ses/{acct}`) and the API answers 404.
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        SelfhostApi: { url: "https://abc123.lambda-url.us-east-1.on.aws/" },
        SelfhostWeb: { url: "https://web.selfhost.example.com" },
      })
    );

    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    const lastWriteContent = String(
      mockWriteFile.mock.calls
        .filter(([path]) => String(path).includes(".env.selfhost"))
        .at(-1)?.[1] ?? ""
    );
    expect(lastWriteContent).toMatch(
      /^WRAPS_API_URL=https:\/\/abc123\.lambda-url\.us-east-1\.on\.aws$/m
    );

    const saved = vi.mocked(metadataModule.saveConnectionMetadata).mock
      .calls[0][0];
    expect(saved.services.selfhost?.apiUrl).toBe(
      "https://abc123.lambda-url.us-east-1.on.aws"
    );
  });

  it("writes SENTRY_DSN to .env.selfhost and metadata when the flag is passed", async () => {
    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
      sentryDsn: "https://abc123@o1.ingest.sentry.io/42",
    });

    const [, content] =
      mockWriteFile.mock.calls.find(([path]) =>
        String(path).includes(".env.selfhost")
      ) ?? [];
    expect(String(content)).toMatch(
      /SENTRY_DSN=https:\/\/abc123@o1\.ingest\.sentry\.io\/42/
    );

    // Persisted too, so `selfhost:upgrade` and the env dump keep reporting on.
    const saved = vi.mocked(metadataModule.saveConnectionMetadata).mock
      .calls[0][0];
    expect(saved.services.selfhost?.config.sentryDsn).toBe(
      "https://abc123@o1.ingest.sentry.io/42"
    );
  });

  it("omits SENTRY_DSN entirely when no DSN is provided", async () => {
    // Opt-in only: without a DSN the deployed SDK no-ops, and nothing is
    // reported anywhere — least of all to Wraps.
    process.env.SENTRY_DSN = "https://wraps-own-dsn@o0.ingest.sentry.io/1";
    try {
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
      expect(String(content)).not.toContain("SENTRY_DSN");
    } finally {
      delete process.env.SENTRY_DSN;
    }
  });

  it("runs sst install then sst deploy, with .env.selfhost written before install", async () => {
    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    const calls = mockRunSubprocess.mock.calls as [string, string[]][];
    const installIdx = calls.findIndex(([, args]) => args.includes("install"));
    const deployIdx = calls.findIndex(([, args]) => args.includes("deploy"));
    expect(installIdx).toBeGreaterThanOrEqual(0);
    expect(deployIdx).toBeGreaterThanOrEqual(0);
    expect(installIdx).toBeLessThan(deployIdx);

    const writeCallOrder = mockWriteFile.mock.invocationCallOrder[0]!;
    const installCallOrder =
      mockRunSubprocess.mock.invocationCallOrder[installIdx]!;
    expect(writeCallOrder).toBeLessThan(installCallOrder);
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

  it("runs database migrations so signup works on a fresh deploy", async () => {
    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "us-east-1",
    });

    expect(mockMigrate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        migrationsFolder: expect.stringContaining("migrations"),
      })
    );
  });

  it("surfaces the underlying pg cause when migrations fail, not just the SQL", async () => {
    const pgError = Object.assign(
      new Error('permission denied for database "wraps"'),
      { code: "42501" }
    );
    const drizzleError = new Error(
      'Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"\nparams: '
    );
    drizzleError.cause = pgError;
    mockMigrate.mockRejectedValue(drizzleError);

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

    const reported = mockLog.error.mock.calls.flat().join("\n");
    expect(reported).toContain("permission denied for database");
    expect(reported).toContain("42501");
    expect(reported).toContain("GRANT CREATE ON DATABASE");
    exitSpy.mockRestore();
  });

  it("publishes the auth email templates into the deploy region", async () => {
    const { deploy } = await import("../deploy.js");
    await deploy({
      databaseUrl: "postgres://user:pass@host/db",
      licenseKey: "wraps_lic_test",
      region: "eu-central-1",
    });

    // Without this the send path is fully wired and still dies at the first
    // signup on "Template email-verification does not exist". The region must
    // be the deploy's, not the ambient one — SES templates are per-region.
    expect(mockProvisionTemplates).toHaveBeenCalledWith("eu-central-1");
  });

  it("still publishes templates when migrations fail", async () => {
    // The two steps are independent: an unreachable database must not also
    // leave the account without templates.
    mockMigrate.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:5432"));

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

    expect(mockProvisionTemplates).toHaveBeenCalledWith("us-east-1");
    exitSpy.mockRestore();
  });

  it("still reports the deployed URLs when migrations fail", async () => {
    mockMigrate.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:5432"));

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

    const info = mockLog.info.mock.calls.flat().join("\n");
    expect(info).toContain("https://api.selfhost.example.com");
    expect(info).toContain("https://web.selfhost.example.com");
    exitSpy.mockRestore();
  });

  it("installs the Pulumi CLI before rerouting — SST never puts it on PATH", async () => {
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

    expect(mockEnsurePulumiInstalled).toHaveBeenCalled();
    expect(mockEnsurePulumiInstalled.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(pulumi.automation.LocalWorkspace.createOrSelectStack).mock
        .invocationCallOrder[0]
    );
  });

  it("keeps a completed deploy usable when the email reroute fails", async () => {
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
    mockEnsurePulumiInstalled.mockRejectedValue(
      new Error("Command failed with ENOENT: pulumi version")
    );

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

    // Migrations still ran and the URLs still printed — only the reroute failed.
    expect(mockMigrate).toHaveBeenCalled();
    const info = mockLog.info.mock.calls.flat().join("\n");
    expect(info).toContain("https://api.selfhost.example.com");
    const reported = mockLog.error.mock.calls.flat().join("\n");
    expect(reported).toMatch(/reroute/i);
    expect(reported).toContain("selfhost:upgrade --reroute-events");
    exitSpy.mockRestore();
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

  it("refuses to redeploy over an existing deployment without .env.selfhost", async () => {
    mockHasExisting.mockResolvedValue(true);

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
    // Must fail BEFORE the .env.selfhost write — its existence permanently
    // locks customers out of the deploy path
    expect(mockWriteFile).not.toHaveBeenCalled();
    exitSpy.mockRestore();
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
