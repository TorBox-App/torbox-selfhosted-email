import * as clack from "@clack/prompts";
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

// ── variant probe mock (never hit real AWS from unit tests) ──────────────────
const mockDetectVariant = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("../../../packages/cli/src/utils/selfhost/variant.js", () => ({
  detectSelfhostVariant: mockDetectVariant,
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
  ListEmailIdentitiesCommand: class {},
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

// Mocked explicitly rather than relying on the @aws-sdk/client-sesv2 mock
// above — that one makes the step silently no-op, so nothing here would
// notice if upgrade stopped calling it.
const mockProvisionTemplates = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("../templates.js", () => ({
  provisionTemplatesWithProgress: mockProvisionTemplates,
}));

// ── email reroute mock ────────────────────────────────────────────────────────
const mockRerouteEmailEvents = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
// Mock only the Pulumi-driving function. sesEventsWebhookUrl stays real — the
// hand-written stub here reimplemented the `/v1/ses-events` bug, so the suite
// stayed green against the very shape it was supposed to catch.
vi.mock("../reroute.js", async () => {
  const actual =
    await vi.importActual<typeof import("../reroute.js")>("../reroute.js");
  return { ...actual, rerouteEmailEvents: mockRerouteEmailEvents };
});

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
    mockDetectVariant.mockResolvedValue(null);
    mockRerouteEmailEvents.mockResolvedValue(undefined);
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

  it("republishes the auth email templates on every upgrade", async () => {
    // Upsert on upgrade is both how a template edit ships and the recovery
    // path for installs deployed before provisioning existed.
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(mockProvisionTemplates).toHaveBeenCalledWith("us-east-1");
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

  it("blocks recovery when a pulumi control plane exists in the account", async () => {
    files.env = "DATABASE_URL=postgres://user:pass@host/db"; // incomplete deploy
    mockDetectVariant.mockResolvedValue("pulumi");

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

  it("blocks recovery when foreign scheduler resources exist (orphans / CLI variant)", async () => {
    files.env = "DATABASE_URL=postgres://user:pass@host/db"; // incomplete deploy
    mockDetectVariant.mockResolvedValue("sst");

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

  it("skips the variant probe entirely once a deploy has completed", async () => {
    // COMPLETE_ENV has NEXT_PUBLIC_APP_URL — the completion marker
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(mockDetectVariant).not.toHaveBeenCalled();
    expect(sstDeployCalls()).toHaveLength(1);
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

  it("backfills WRAPS_API_URL even when the operator supplied the app URL", async () => {
    // The shape .github/workflows/selfhost-deploy.yml reconstructs from
    // repository secrets: NEXT_PUBLIC_APP_URL comes from a repo variable, but
    // WRAPS_API_URL and BETTER_AUTH_URL are not secrets the operator holds.
    // Gating the backfill on NEXT_PUBLIC_APP_URL alone left WRAPS_API_URL empty
    // on every CI upgrade, so the API advertised `issuer: api.wraps.dev` and
    // handed customers a platform webhook endpoint.
    files.env = [
      "DATABASE_URL=postgres://user:pass@host/db",
      "LICENSE_KEY=wraps_lic_test",
      "BETTER_AUTH_SECRET=secret2",
      "UNSUBSCRIBE_SECRET=secret1",
      "SELFHOST_AWS_REGION=us-east-1",
      "NEXT_PUBLIC_APP_URL=https://web.selfhost.example.com",
    ].join("\n");
    // A CI runner is a fresh clone: infra/.sst/outputs.json is gitignored, so
    // the URLs only exist once this run's deploy has emitted them.
    files.outputs = null;
    mockRunSubprocess.mockImplementation(async (_cmd, args) => {
      if ((args as string[]).includes("deploy")) {
        files.outputs = OUTPUTS_JSON;
      }
    });

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(files.env).toMatch(
      /WRAPS_API_URL=https:\/\/api\.selfhost\.example\.com/
    );
    expect(files.env).toMatch(
      /BETTER_AUTH_URL=https:\/\/web\.selfhost\.example\.com/
    );
    // Written after the first deploy, so a second pass bakes them into the build.
    expect(sstDeployCalls()).toHaveLength(2);
  });

  it("does not redeploy when every deploy-output var is already present", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(sstDeployCalls()).toHaveLength(1);
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

  // A stack first deployed without a domain bakes its CloudFront URL, and
  // appendMissingEnvVars only writes absent keys — so attaching a domain later
  // used to leave the web build calling the old origin for /api/auth, which
  // then failed CORS against its own dashboard.
  const CLOUDFRONT_ENV = COMPLETE_ENV.replaceAll(
    "https://web.selfhost.example.com",
    "https://d2z0umfq9796jk.cloudfront.net"
  );

  it("repoints the app URLs when --web-domain is added to a CloudFront deployment", async () => {
    files.env = CLOUDFRONT_ENV;

    const { upgrade } = await import("../upgrade.js");
    await upgrade({
      region: "us-east-1",
      yes: true,
      webDomain: "mail.acme.com",
    });

    expect(files.env).toMatch(
      /NEXT_PUBLIC_APP_URL=https:\/\/mail\.acme\.com$/m
    );
    expect(files.env).toMatch(/BETTER_AUTH_URL=https:\/\/mail\.acme\.com$/m);
    expect(files.env).not.toContain("cloudfront.net");
  });

  it("repoints from a domain already on file, with no flag passed", async () => {
    // The customer-shaped case: the domain was added on an earlier run, so
    // nothing is passed this time and the stale URL has to be caught anyway.
    files.env = `${CLOUDFRONT_ENV}\nSELFHOST_WEB_DOMAIN=mail.acme.com\n`;

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(files.env).toMatch(
      /NEXT_PUBLIC_APP_URL=https:\/\/mail\.acme\.com$/m
    );
    expect(files.env).not.toContain("cloudfront.net");
  });

  it("strips a trailing slash a hand-edited domain brought with it", async () => {
    // CORS_ORIGIN is derived from this and compared against the browser's
    // Origin header, which never has a trailing slash.
    files.env = CLOUDFRONT_ENV;

    const { upgrade } = await import("../upgrade.js");
    await upgrade({
      region: "us-east-1",
      yes: true,
      webDomain: "https://mail.acme.com/",
    });

    expect(files.env).toMatch(
      /NEXT_PUBLIC_APP_URL=https:\/\/mail\.acme\.com$/m
    );
    expect(files.env).not.toMatch(/NEXT_PUBLIC_APP_URL=.*\/$/m);
  });

  it("leaves the URLs alone when they already match the domain", async () => {
    files.env = `${COMPLETE_ENV}\nSELFHOST_WEB_DOMAIN=web.selfhost.example.com\n`;

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    const repointed = vi
      .mocked(clack.log.info)
      .mock.calls.filter(([msg]) => String(msg).includes("Repointed"));
    expect(repointed).toEqual([]);
  });

  it("leaves a domainless deployment on its CloudFront URL", async () => {
    files.env = CLOUDFRONT_ENV;

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(files.env).toMatch(
      /NEXT_PUBLIC_APP_URL=https:\/\/d2z0umfq9796jk\.cloudfront\.net$/m
    );
  });

  it("replaces an existing SENTRY_DSN when --sentry-dsn is passed", async () => {
    files.env = `${files.env}\nSENTRY_DSN=https://old@o1.ingest.sentry.io/1\n`;

    const { upgrade } = await import("../upgrade.js");
    await upgrade({
      region: "us-east-1",
      yes: true,
      sentryDsn: "https://new@o2.ingest.sentry.io/2",
    });

    // upsert, not append — a rotated DSN must not leave the old line behind for
    // parseEnvFile to pick up first.
    expect(files.env).toMatch(
      /SENTRY_DSN=https:\/\/new@o2\.ingest\.sentry\.io\/2/
    );
    expect(files.env).not.toContain("https://old@o1.ingest.sentry.io/1");
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

  it("reports the pg cause behind a failed migration, not just the SQL", async () => {
    const pgError = Object.assign(new Error("password authentication failed"), {
      code: "28P01",
    });
    const drizzleError = new Error(
      'Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"\nparams: '
    );
    drizzleError.cause = pgError;
    mockMigrate.mockRejectedValue(drizzleError);

    const { upgrade } = await import("../upgrade.js");
    await expect(upgrade({ region: "us-east-1", yes: true })).rejects.toThrow(
      /password authentication failed/
    );
  });

  it("does not reroute email events unless asked", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(mockRerouteEmailEvents).not.toHaveBeenCalled();
  });

  it("keeps a successful upgrade when the reroute fails", async () => {
    mockRerouteEmailEvents.mockRejectedValue(
      new Error("Command failed with ENOENT: pulumi version")
    );
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { upgrade } = await import("../upgrade.js");
    await expect(
      upgrade({ region: "us-east-1", yes: true, rerouteEvents: true })
    ).rejects.toThrow("process.exit called");

    // The upgrade's own bookkeeping must survive a failed reroute.
    expect(metadataModule.saveConnectionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        services: expect.objectContaining({
          selfhost: expect.objectContaining({
            apiUrl: "https://api.selfhost.example.com",
          }),
        }),
      })
    );
    exitSpy.mockRestore();
  });

  it("retries the email reroute with --reroute-events", async () => {
    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true, rerouteEvents: true });

    expect(mockRerouteEmailEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "123456789012",
        region: "us-east-1",
        apiUrl: "https://api.selfhost.example.com",
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

  // What SST actually emits for `url: true`. AWS Function URLs always carry the
  // trailing slash, and every consumer of this value appends a path to it.
  const SLASHED_OUTPUTS = JSON.stringify({
    SelfhostApi: { url: "https://abc123.lambda-url.us-east-1.on.aws/" },
    SelfhostWeb: { url: "https://web.selfhost.example.com" },
  });

  it("strips the Lambda Function URL's trailing slash from the saved apiUrl", async () => {
    files.outputs = SLASHED_OUTPUTS;

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(metadataModule.saveConnectionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        services: expect.objectContaining({
          selfhost: expect.objectContaining({
            apiUrl: "https://abc123.lambda-url.us-east-1.on.aws",
          }),
        }),
      })
    );
  });

  it("backfills WRAPS_API_URL without the Function URL's trailing slash", async () => {
    // Recovery path: the env file is what the deployed API and web build read,
    // so a doubled slash here reaches the customer's own webhook endpoint.
    files.env = [
      "DATABASE_URL=postgres://user:pass@host/db",
      "LICENSE_KEY=wraps_lic_test",
      "BETTER_AUTH_SECRET=secret2",
      "UNSUBSCRIBE_SECRET=secret1",
      "SELFHOST_AWS_REGION=us-east-1",
    ].join("\n");
    files.outputs = null;
    mockRunSubprocess.mockImplementation(async (_cmd, args) => {
      if ((args as string[]).includes("deploy")) {
        files.outputs = SLASHED_OUTPUTS;
      }
    });

    const { upgrade } = await import("../upgrade.js");
    await upgrade({ region: "us-east-1", yes: true });

    expect(files.env).toMatch(
      /^WRAPS_API_URL=https:\/\/abc123\.lambda-url\.us-east-1\.on\.aws$/m
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
