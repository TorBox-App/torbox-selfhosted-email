import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test: wraps email destroy handles pulumi failures gracefully
 *
 * Previously, when `stack.destroy()` failed with exit code 255 (partial destruction),
 * the error was thrown and `deleteConnectionMetadata` was never reached.
 * The infrastructure was partially destroyed but metadata remained on disk,
 * leaving the user in a broken state.
 *
 * Fix: The destroy command now:
 * 1. Calls stack.refresh() before stack.destroy() to sync state with AWS
 * 2. Passes continueOnError: true so partial deletes don't abort
 * 3. Cleans up metadata even when destroy fails partially
 */

// ---- Mocks ----

// Mock clack prompts (used for UI)
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  select: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
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
  })),
}));

// Mock picocolors (used for terminal colors)
vi.mock("picocolors", () => ({
  default: {
    bold: (s: string) => s,
    red: (s: string) => s,
    green: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    yellow: (s: string) => s,
    blue: (s: string) => s,
  },
}));

// Mock telemetry
vi.mock("../telemetry/events.js", () => ({
  trackError: vi.fn(),
  trackServiceRemoved: vi.fn(),
}));

// Mock AWS credential validation
vi.mock("../utils/shared/aws.js", () => ({
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    userId: "AIDAEXAMPLE",
    arn: "arn:aws:iam::123456789012:user/test",
  }),
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
}));

// Mock Route53 utilities
vi.mock("../utils/route53.js", () => ({
  findHostedZone: vi.fn().mockResolvedValue(null),
  deleteDNSRecords: vi.fn().mockResolvedValue(undefined),
}));

// Mock filesystem utilities
vi.mock("../utils/shared/fs.js", () => ({
  ensurePulumiWorkDir: vi.fn().mockResolvedValue(undefined),
  getPulumiWorkDir: vi.fn().mockReturnValue("/tmp/wraps-test/pulumi"),
}));

// Mock metadata utilities
const mockDeleteConnectionMetadata = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/shared/metadata.js", () => ({
  loadConnectionMetadata: vi.fn().mockResolvedValue({
    version: "1.0.0",
    accountId: "123456789012",
    region: "us-east-1",
    provider: "vercel",
    timestamp: "2024-01-01T00:00:00.000Z",
    services: {
      email: {
        preset: "production",
        config: {
          domain: "example.com",
          sendingEnabled: true,
          tracking: { enabled: true },
        },
        pulumiStackName: "wraps-123456789012-us-east-1",
        deployedAt: "2024-01-01T00:00:00.000Z",
      },
    },
  }),
  deleteConnectionMetadata: mockDeleteConnectionMetadata,
  findConnectionsWithService: vi.fn().mockResolvedValue([]),
}));

// Mock SES v2 client (for getEmailIdentityInfo)
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      DkimAttributes: { Tokens: [] },
      MailFromAttributes: {},
    }),
  })),
  GetEmailIdentityCommand: vi.fn(),
}));

// Track whether stack methods were called and mock Pulumi automation
const mockStackDestroy = vi.fn();
const mockStackRefresh = vi.fn().mockResolvedValue(undefined);
const mockRemoveStack = vi.fn();

vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      selectStack: vi.fn().mockResolvedValue({
        destroy: mockStackDestroy,
        refresh: mockStackRefresh,
        workspace: {
          removeStack: mockRemoveStack,
        },
      }),
    },
  },
}));

// Mock the timeout wrapper to just execute the promise directly
vi.mock("../utils/shared/timeout.js", () => ({
  DEFAULT_PULUMI_TIMEOUT_MS: 600_000,
  withTimeout: vi.fn(async (promise: Promise<any>) => promise),
}));

// Mock the pulumi utility
vi.mock("../utils/shared/pulumi.js", () => ({
  previewWithResourceChanges: vi.fn(),
}));

// Mock errors module
vi.mock("../utils/shared/errors.js", async () => {
  const actual = (await vi.importActual("../utils/shared/errors.js")) as any;
  return {
    ...actual,
  };
});

// Mock the output module
vi.mock("../utils/shared/output.js", async () => {
  const actual = (await vi.importActual("../utils/shared/output.js")) as any;
  return {
    ...actual,
  };
});

describe("wraps email destroy - exit code 255 bug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStackDestroy.mockReset();
    mockStackRefresh.mockReset().mockResolvedValue(undefined);
    mockRemoveStack.mockReset();
    mockDeleteConnectionMetadata.mockReset().mockResolvedValue(undefined);
  });

  it("should clean up metadata when pulumi destroy fails with exit code 255", async () => {
    const pulumiError = new Error(
      "Command failed with exit code 255: pulumi destroy --yes --skip-preview --exec-kind auto.local --stack wraps-123456789012-us-east-1 --non-interactive"
    );

    mockStackDestroy.mockRejectedValue(pulumiError);

    const { emailDestroy } = await import("../commands/email/destroy.js");

    // Should NOT throw — partial failure is handled gracefully
    await emailDestroy({ force: true, region: "us-east-1" });

    // Metadata should be cleaned up even though destroy partially failed
    expect(mockDeleteConnectionMetadata).toHaveBeenCalledWith(
      "123456789012",
      "us-east-1"
    );
  });

  it("should not leave stale metadata after partial pulumi destroy failure", async () => {
    const partialDestroyError = new Error(
      "code: -2\nstderr: Command failed with exit code 255: pulumi destroy --yes " +
        "--skip-preview --exec-kind auto.local --stack wraps-123456789012-us-east-1 --non-interactive\n" +
        "Destroying (wraps-123456789012-us-east-1):\n" +
        " -  aws:iam:RolePolicy wraps-email-policy deleting (0s)\n" +
        " -  aws:sesv2:ConfigurationSetEventDestination wraps-email-all-events deleting (0s)"
    );

    mockStackDestroy.mockRejectedValue(partialDestroyError);

    const { emailDestroy } = await import("../commands/email/destroy.js");

    await emailDestroy({ force: true, region: "us-east-1" });

    expect(mockDeleteConnectionMetadata).toHaveBeenCalledWith(
      "123456789012",
      "us-east-1"
    );
  });

  it("should call stack.refresh() before stack.destroy()", async () => {
    mockStackDestroy.mockResolvedValue(undefined);
    mockRemoveStack.mockResolvedValue(undefined);

    const { emailDestroy } = await import("../commands/email/destroy.js");

    await emailDestroy({ force: true, region: "us-east-1" });

    // refresh should be called to sync Pulumi state with actual AWS resources
    expect(mockStackRefresh).toHaveBeenCalled();

    // refresh must be called before destroy
    const refreshOrder = mockStackRefresh.mock.invocationCallOrder[0];
    const destroyOrder = mockStackDestroy.mock.invocationCallOrder[0];
    expect(refreshOrder).toBeLessThan(destroyOrder);
  });

  it("should pass continueOnError to stack.destroy()", async () => {
    mockStackDestroy.mockResolvedValue(undefined);
    mockRemoveStack.mockResolvedValue(undefined);

    const { emailDestroy } = await import("../commands/email/destroy.js");

    await emailDestroy({ force: true, region: "us-east-1" });

    expect(mockStackDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ continueOnError: true })
    );
  });

  it("should still throw for stack lock errors", async () => {
    const lockError = new Error("the stack is currently locked by 1 lock(s)");
    mockStackDestroy.mockRejectedValue(lockError);

    const { emailDestroy } = await import("../commands/email/destroy.js");

    await expect(
      emailDestroy({ force: true, region: "us-east-1" })
    ).rejects.toThrow();

    // Metadata should NOT be cleaned up for lock errors (infrastructure still exists)
    expect(mockDeleteConnectionMetadata).not.toHaveBeenCalled();
  });
});
