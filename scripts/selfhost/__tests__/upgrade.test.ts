import { beforeEach, describe, expect, it, vi } from "vitest";

// ── subprocess mock ──────────────────────────────────────────────────────────
const mockRunSubprocess = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
vi.mock("../subprocess.js", () => ({
  runSubprocess: mockRunSubprocess,
  REPO_ROOT: "/mock/repo",
}));

// ── fs mock (path-aware: .env.selfhost and outputs.json are distinct files) ──
const COMPLETE_ENV = [
  "DATABASE_URL=postgres://user:pass@host/db",
  "LICENSE_KEY=wraps_lic_test",
  "BETTER_AUTH_SECRET=secret2",
  "UNSUBSCRIBE_SECRET=secret1",
  "SELFHOST_AWS_REGION=us-east-1",
  "NEXT_PUBLIC_APP_URL=https://web.selfhost.example.com",
  "WRAPS_API_URL=https://api.selfhost.example.com",
  "BETTER_AUTH_URL=https://web.selfhost.example.com",
].join("\n");

const OUTPUTS_JSON = JSON.stringify({
  SelfhostApi: { url: "https://api.selfhost.example.com" },
  SelfhostWeb: { url: "https://web.selfhost.example.com" },
});

const files = vi.hoisted(() => ({
  env: "" as string | null, // null → ENOENT
  outputs: "" as string | null,
}));

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockAccess = vi.hoisted(() => vi.fn());
const mockChmod = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("node:fs/promises", () => ({
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  access: mockAccess,
  chmod: mockChmod,
}));

function wireFsMocks() {
  const enoent = () =>
    Object.assign(new Error("ENOENT"), { code: "ENOENT" as const });
  mockReadFile.mockImplementation((path: unknown) => {
    const p = String(path);
    if (p.includes(".env.selfhost")) {
      return files.env === null
        ? Promise.reject(enoent())
        : Promise.resolve(files.env);
    }
    if (p.includes("outputs.json")) {
      return files.outputs === null
        ? Promise.reject(enoent())
        : Promise.resolve(files.outputs);
    }
    return Promise.reject(enoent());
  });
  mockWriteFile.mockImplementation((path: unknown, content: unknown) => {
    if (String(path).includes(".env.selfhost")) {
      files.env = String(content);
    }
    return Promise.resolve();
  });
  mockAccess.mockImplementation((path: unknown) =>
    String(path).includes(".env.selfhost") && files.env === null
      ? Promise.reject(enoent())
      : Promise.resolve()
  );
}

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

// ── email stack detection (avoid live AWS SDK calls) ─────────────────────────
vi.mock("@aws-sdk/client-iam", () => ({
  IAMClient: class {
    send = vi.fn().mockRejectedValue(new Error("no creds"));
  },
  GetRoleCommand: class {},
}));
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn().mockRejectedValue(new Error("no creds"));
  },
  ListConfigurationSetsCommand: class {},
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

function sstDeployCalls() {
  return mockRunSubprocess.mock.calls.filter(([, args]) =>
    (args as string[])?.includes("deploy")
  );
}

describe("scripts/selfhost/upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSubprocess.mockResolvedValue(undefined);
    mockConfirm.mockResolvedValue(true);
    mockMigrate.mockResolvedValue(undefined);
    mockChmod.mockResolvedValue(undefined);
    files.env = COMPLETE_ENV;
    files.outputs = OUTPUTS_JSON;
    wireFsMocks();
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

    expect(sstDeployCalls().length).toBeGreaterThanOrEqual(1);
  });

  it("runs a single sst deploy when .env.selfhost is already complete", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(sstDeployCalls()).toHaveLength(1);
  });

  it("passes SELFHOST_AWS_REGION from .env.selfhost to the sst subprocess", async () => {
    files.env = COMPLETE_ENV.replace(
      "SELFHOST_AWS_REGION=us-east-1",
      "SELFHOST_AWS_REGION=eu-west-1"
    );

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ yes: true });

    const [, , env] = sstDeployCalls()[0]!;
    expect(env).toMatchObject({ SELFHOST_AWS_REGION: "eu-west-1" });
  });

  it("backfills URL env vars and redeploys when recovering a partial first deploy", async () => {
    // Partial deploy: env has only the pre-deploy vars, no NEXT_PUBLIC_APP_URL
    files.env = [
      "DATABASE_URL=postgres://user:pass@host/db",
      "LICENSE_KEY=wraps_lic_test",
      "BETTER_AUTH_SECRET=secret2",
      "UNSUBSCRIBE_SECRET=secret1",
    ].join("\n");
    // outputs.json doesn't exist yet — the first deploy crashed before sst ran
    files.outputs = null;
    mockRunSubprocess.mockImplementation(async (_cmd, args) => {
      if ((args as string[]).includes("deploy")) {
        files.outputs = OUTPUTS_JSON; // sst deploy emits outputs
      }
    });

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    // First deploy emits URLs → backfill → second deploy bakes them in
    expect(sstDeployCalls()).toHaveLength(2);
    expect(files.env).toMatch(
      /NEXT_PUBLIC_APP_URL=https:\/\/web\.selfhost\.example\.com/
    );
    expect(files.env).toMatch(
      /BETTER_AUTH_URL=https:\/\/web\.selfhost\.example\.com/
    );
    expect(files.env).toMatch(
      /WRAPS_API_URL=https:\/\/api\.selfhost\.example\.com/
    );
  });

  it("updates .env.selfhost when --web-domain is passed", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({
      region: "us-east-1",
      yes: true,
      webDomain: "mail.acme.com",
    });

    expect(files.env).toMatch(/SELFHOST_WEB_DOMAIN=mail\.acme\.com/);
  });

  it("runs database migrations after deploy", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(mockMigrate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        migrationsFolder: expect.stringContaining("migrations"),
      })
    );
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
    files.outputs = JSON.stringify({});

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

  it("recovers metadata from .env.selfhost when metadata has no selfhost service", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue({
      ...structuredClone(BASE_METADATA),
      services: {},
    } as never);

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    const savedArg = vi.mocked(metadataModule.saveConnectionMetadata).mock
      .calls[0]?.[0] as never;
    expect(savedArg?.services?.selfhost?.config?.databaseUrl).toBe(
      "postgres://user:pass@host/db"
    );
    expect(savedArg?.services?.selfhost?.apiUrl).toBe(
      "https://api.selfhost.example.com"
    );
  });

  it("exits early with error when metadata and .env.selfhost are both unusable", async () => {
    vi.mocked(metadataModule.loadConnectionMetadata).mockResolvedValue({
      ...structuredClone(BASE_METADATA),
      services: {},
    } as never);
    files.env = "SOME_OTHER_VAR=1"; // no DATABASE_URL → nothing to recover from

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
    files.env = null;

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
