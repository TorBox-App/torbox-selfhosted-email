import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import {
  GetParameterCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { encodeReplyToken } from "@wraps/core";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";
import {
  deployHooks,
  replyDecode,
  replyDestroy,
  replyInit,
} from "../email/reply.js";

const ssmMock = mockClient(SSMClient);

// Mock clack
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  log: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    step: vi.fn(),
  },
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
}));

// Mock telemetry
vi.mock("../../telemetry/events.js", () => ({
  trackCommand: vi.fn(),
  trackError: vi.fn(),
}));

// Mock AWS credentials
vi.mock("../../utils/shared/aws.js", () => ({
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    userId: "AIDATEST",
    arn: "arn:aws:iam::123456789012:user/test",
  }),
}));

// Mock Pulumi install check
vi.mock("../../utils/shared/pulumi.js", () => ({
  ensurePulumiInstalled: vi.fn().mockResolvedValue(undefined),
  withLockRetry: vi
    .fn()
    .mockImplementation(async (fn: () => Promise<unknown>) => fn()),
}));

// Mock metadata
vi.mock("../../utils/shared/metadata.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../utils/shared/metadata.js")>();
  return {
    ...actual,
    loadConnectionMetadata: vi.fn(),
    saveConnectionMetadata: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock receipt rule helpers
vi.mock("../../utils/email/receipt-rules.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../utils/email/receipt-rules.js")>();
  return {
    ...actual,
    addDomainToReceiptRule: vi.fn().mockResolvedValue(undefined),
    removeDomainFromReceiptRule: vi.fn().mockResolvedValue(undefined),
    getReceiptRuleDomains: vi.fn().mockResolvedValue([]),
  };
});

// Mock DNS detection/creation so init doesn't touch the network
vi.mock("../../utils/dns/index.js", () => ({
  detectAvailableDNSProviders: vi
    .fn()
    .mockResolvedValue([{ provider: "manual", detected: true }]),
  getDNSCredentials: vi.fn().mockResolvedValue({
    valid: true,
    credentials: { provider: "manual" },
  }),
  createInboundDNSRecordsForProvider: vi
    .fn()
    .mockResolvedValue({ success: true, recordsCreated: 0 }),
  buildInboundDNSRecords: vi.fn().mockReturnValue([]),
  formatManualDNSInstructions: vi.fn().mockReturnValue(""),
  getDNSProviderDisplayName: vi.fn().mockReturnValue("Manual"),
}));

const baseMetadata = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2024-01-01T00:00:00.000Z",
  services: {
    email: {
      config: {
        domain: "foo.com",
        inbound: {
          enabled: true,
          subdomain: "support",
          receivingDomain: "support.foo.com",
          bucketName: "wraps-inbound-123456789012-us-east-1",
        },
        inboundDomains: [
          {
            subdomain: "support",
            receivingDomain: "support.foo.com",
            parentDomain: "support.foo.com",
            addedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
      preset: "starter" as const,
      deployedAt: "2024-01-01T00:00:00.000Z",
      pulumiStackName: "wraps-123456789012-us-east-1",
    },
  },
};

function cloneMetadata(
  overrides?: (m: typeof baseMetadata) => void
): typeof baseMetadata {
  const copy = JSON.parse(JSON.stringify(baseMetadata)) as typeof baseMetadata;
  overrides?.(copy);
  return copy;
}

describe("replyDecode", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("decodes a real signed reply address into JSON without AWS calls", async () => {
    const secret = randomBytes(32);
    const convIdHex = "0102030405060708";
    const sendIdHex = "1112131415161718";
    const convId = Buffer.from(convIdHex, "hex");
    const sendId = Buffer.from(sendIdHex, "hex");
    const exp = Math.floor(Date.now() / 1000) + 3600;

    const token = encodeReplyToken({
      kid: 7,
      convId,
      sendId,
      exp,
      secret,
    });
    const address = `${token}@r.mail.foo.com`;

    await replyDecode(address);

    // Find the JSON output among console.log calls
    const jsonCall = consoleLogSpy.mock.calls.find((call) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.sendingDomain === "foo.com";
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.sendingDomain).toBe("foo.com");
    expect(parsed.version).toBe(1);
    expect(parsed.kid).toBe(7);
    expect(parsed.convId).toBe(convIdHex);
    expect(parsed.sendId).toBe(sendIdHex);
    expect(parsed.exp).toBe(exp);
    expect(typeof parsed.hmacHex).toBe("string");
    expect(parsed.hmacHex.length).toBe(32); // 16 bytes hex
  });
});

describe("replyInit", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ssmMock.reset();
    vi.clearAllMocks();
    setJsonMode(false);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((_code?: number) => {}) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Replace the Pulumi deploy hook with a no-op spy so tests don't spin up
    // a real workspace.
    deployHooks.deploy = vi.fn().mockResolvedValue(undefined);

    // Default SSM responses for reply-init success path
    ssmMock.on(GetParameterCommand).callsFake((input) => ({
      Parameter: {
        ARN: `arn:aws:ssm:us-east-1:123456789012:parameter${input.Name}`,
        Name: input.Name,
        Value: JSON.stringify({ kid: 1, current: "AAAA" }),
      },
    }));
    ssmMock.on(PutParameterCommand).resolves({ Version: 2 });
  });

  it("refuses when target domain is not configured for inbound", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(cloneMetadata());

    await expect(
      replyInit({ domain: "not-inbound.foo.com" })
    ).rejects.toMatchObject({
      code: "REPLY_INBOUND_DOMAIN_NOT_FOUND",
      suggestion: expect.stringContaining(
        "wraps email inbound add not-inbound.foo.com"
      ),
    });
    // Sanity: we didn't try to deploy
    expect(deployHooks.deploy).not.toHaveBeenCalled();
  });

  it("refuses when reply threading is already enabled for that domain", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    const meta = cloneMetadata((m) => {
      // biome-ignore lint/suspicious/noExplicitAny: test mutation on typed metadata
      (m.services.email.config as any).replyThreading = {
        enabled: true,
        domains: [
          {
            domain: "support.foo.com",
            parameterArn:
              "arn:aws:ssm:us-east-1:123456789012:parameter/wraps/email/reply-secret/support.foo.com",
            parameterName: "/wraps/email/reply-secret/support.foo.com",
            currentKid: 1,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
      };
    });
    vi.mocked(loadConnectionMetadata).mockResolvedValue(meta);

    await expect(
      replyInit({ domain: "support.foo.com" })
    ).rejects.toMatchObject({
      code: "REPLY_ALREADY_ENABLED",
      suggestion: expect.stringContaining(
        "wraps email reply rotate --domain support.foo.com"
      ),
    });

    expect(deployHooks.deploy).not.toHaveBeenCalled();
  });

  it("--all enables every inbound domain and skips those already enabled", async () => {
    const { loadConnectionMetadata, saveConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    const meta = cloneMetadata((m) => {
      m.services.email.config.inboundDomains = [
        {
          subdomain: "support",
          receivingDomain: "support.foo.com",
          parentDomain: "support.foo.com",
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          subdomain: "sales",
          receivingDomain: "sales.foo.com",
          parentDomain: "sales.foo.com",
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ];
      // biome-ignore lint/suspicious/noExplicitAny: test setup
      (m.services.email.config as any).replyThreading = {
        enabled: true,
        domains: [
          {
            domain: "support.foo.com",
            parameterArn:
              "arn:aws:ssm:us-east-1:123456789012:parameter/wraps/email/reply-secret/support.foo.com",
            parameterName: "/wraps/email/reply-secret/support.foo.com",
            currentKid: 1,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
      };
    });

    // Each call to loadConnectionMetadata returns a fresh copy so inner loop
    // iterations pick up the evolving metadata.
    vi.mocked(loadConnectionMetadata).mockImplementation(async () =>
      JSON.parse(JSON.stringify(meta))
    );

    await replyInit({ all: true, yes: true });

    // The deploy helper must have been called once: sales.foo.com new, support
    // already enabled.
    expect(deployHooks.deploy).toHaveBeenCalledTimes(1);

    // saveConnectionMetadata invoked at least once for the sales.foo.com entry
    expect(vi.mocked(saveConnectionMetadata)).toHaveBeenCalled();
    // Inspect the last save: it should carry sales.foo.com without an
    // initialSecret lingering.
    const saves = vi.mocked(saveConnectionMetadata).mock.calls;
    const finalSave = saves.at(-1)?.[0];
    expect(finalSave).toBeDefined();
    const finalRt =
      // biome-ignore lint/suspicious/noExplicitAny: dynamic inspection
      (finalSave as any)?.services?.email?.config?.replyThreading;
    expect(finalRt.enabled).toBe(true);
    const salesEntry = finalRt.domains.find(
      // biome-ignore lint/suspicious/noExplicitAny: dynamic inspection
      (d: any) => d.domain === "sales.foo.com"
    );
    expect(salesEntry).toBeDefined();
    expect(salesEntry.initialSecret).toBeUndefined();
  });

  it("noops with a friendly message when --all and everything is already enabled", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    const meta = cloneMetadata((m) => {
      // biome-ignore lint/suspicious/noExplicitAny: test setup
      (m.services.email.config as any).replyThreading = {
        enabled: true,
        domains: [
          {
            domain: "support.foo.com",
            parameterArn:
              "arn:aws:ssm:us-east-1:123456789012:parameter/wraps/email/reply-secret/support.foo.com",
            parameterName: "/wraps/email/reply-secret/support.foo.com",
            currentKid: 1,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
      };
    });
    vi.mocked(loadConnectionMetadata).mockResolvedValue(meta);

    await replyInit({ all: true });

    expect(deployHooks.deploy).not.toHaveBeenCalled();
  });

  // Keep references to spies so TS doesn't complain about unused locals.
  // Accessed in `beforeEach`; this is a sentinel assertion.
  it("spy setup", () => {
    expect(exitSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });
});

describe("replyDestroy", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ssmMock.reset();
    vi.clearAllMocks();
    setJsonMode(false);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((_code?: number) => {}) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("spy setup", () => {
    expect(exitSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  it("does NOT persist metadata when Pulumi redeploy fails — state stays recoverable", async () => {
    const { loadConnectionMetadata, saveConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    const meta = cloneMetadata((m) => {
      // biome-ignore lint/suspicious/noExplicitAny: test setup
      (m.services.email.config as any).replyThreading = {
        enabled: true,
        domains: [
          {
            domain: "support.foo.com",
            parameterArn:
              "arn:aws:ssm:us-east-1:123456789012:parameter/wraps/email/reply-secret/support.foo.com",
            parameterName: "/wraps/email/reply-secret/support.foo.com",
            currentKid: 1,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
      };
    });
    vi.mocked(loadConnectionMetadata).mockResolvedValue(meta);

    // Simulate a Pulumi deploy failure.
    deployHooks.deploy = vi
      .fn()
      .mockRejectedValue(new Error("pulumi up failed"));

    await expect(
      replyDestroy({ domain: "support.foo.com", force: true })
    ).rejects.toThrow(/pulumi up failed/);

    // Metadata must NOT have been persisted — otherwise the domain is gone
    // from disk but the SSM parameter still exists, leaving state stuck.
    expect(vi.mocked(saveConnectionMetadata)).not.toHaveBeenCalled();
  });

  it("does NOT mutate SES receipt rule when Pulumi redeploy fails", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    const { removeDomainFromReceiptRule } = await import(
      "../../utils/email/receipt-rules.js"
    );
    const meta = cloneMetadata((m) => {
      // biome-ignore lint/suspicious/noExplicitAny: test setup
      (m.services.email.config as any).replyThreading = {
        enabled: true,
        domains: [
          {
            domain: "support.foo.com",
            parameterArn:
              "arn:aws:ssm:us-east-1:123456789012:parameter/wraps/email/reply-secret/support.foo.com",
            parameterName: "/wraps/email/reply-secret/support.foo.com",
            currentKid: 1,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
          {
            domain: "sales.foo.com",
            parameterArn:
              "arn:aws:ssm:us-east-1:123456789012:parameter/wraps/email/reply-secret/sales.foo.com",
            parameterName: "/wraps/email/reply-secret/sales.foo.com",
            currentKid: 1,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
      };
    });
    vi.mocked(loadConnectionMetadata).mockResolvedValue(meta);

    deployHooks.deploy = vi
      .fn()
      .mockRejectedValue(new Error("pulumi up failed"));

    await expect(replyDestroy({ all: true, force: true })).rejects.toThrow(
      /pulumi up failed/
    );

    // Receipt rule mutations must only run after Pulumi deploy succeeds.
    // Otherwise, --all with N domains that fails on deploy would commit
    // N real SES receipt-rule changes to an account that's otherwise in
    // its original state.
    expect(vi.mocked(removeDomainFromReceiptRule)).not.toHaveBeenCalled();
  });

  it("persists metadata only after a successful Pulumi redeploy", async () => {
    const { loadConnectionMetadata, saveConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    const meta = cloneMetadata((m) => {
      // biome-ignore lint/suspicious/noExplicitAny: test setup
      (m.services.email.config as any).replyThreading = {
        enabled: true,
        domains: [
          {
            domain: "support.foo.com",
            parameterArn:
              "arn:aws:ssm:us-east-1:123456789012:parameter/wraps/email/reply-secret/support.foo.com",
            parameterName: "/wraps/email/reply-secret/support.foo.com",
            currentKid: 1,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
      };
    });
    vi.mocked(loadConnectionMetadata).mockResolvedValue(meta);

    const order: string[] = [];
    deployHooks.deploy = vi.fn().mockImplementation(async () => {
      order.push("deploy");
    });
    vi.mocked(saveConnectionMetadata).mockImplementation(async () => {
      order.push("save");
    });

    await replyDestroy({ domain: "support.foo.com", force: true });

    expect(vi.mocked(saveConnectionMetadata)).toHaveBeenCalled();
    expect(order).toEqual(["deploy", "save"]);
  });
});
