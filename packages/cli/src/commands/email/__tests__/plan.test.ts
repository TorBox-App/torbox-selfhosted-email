/**
 * Unit tests for `wraps email plan` — detect the account's SES pricing plan,
 * price every option against real volume, and (with `--set`) offer the fix.
 *
 * Mocking shape follows `packages/cli/src/commands/__tests__/check.test.ts`
 * and `status.test.ts`: the AWS SDK boundary is mocked via
 * `aws-sdk-client-mock` (SESv2 + STS), while the real `emailPlan` control
 * flow — including the `aws.ts` helpers it calls — runs unmocked.
 */

import {
  GetAccountCommand,
  PutAccountPricingAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SES_PRICING_PLANS } from "../../../utils/email/ses-plans.js";
import { setJsonMode } from "../../../utils/shared/json-output.js";

const stsMock = mockClient(STSClient);
const sesv2Mock = mockClient(SESv2Client);

// Mock aws-detection to prevent real filesystem reads (SSO cache, AWS config).
vi.mock("../../../utils/shared/aws-detection.js", () => ({
  detectAWSState: vi.fn().mockResolvedValue({
    cliInstalled: true,
    cliVersion: "2.15.0",
    credentialsConfigured: true,
    credentialSource: "environment",
    profileName: "default",
    accountId: "123456789012",
    detectedProvider: null,
    region: "us-east-1",
    sso: {
      configured: false,
      profiles: [],
      sessions: [],
      tokenStatus: null,
      activeProfile: null,
    },
  }),
  getCurrentProfile: vi.fn().mockReturnValue("default"),
  getConfiguredProfiles: vi.fn().mockReturnValue([]),
  getSSOLoginCommand: vi.fn().mockReturnValue("aws sso login"),
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  confirm: vi.fn(),
  select: vi.fn(),
  log: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("../../../telemetry/client.js", () => ({
  getTelemetryClient: vi.fn().mockReturnValue({
    showFooterOnce: vi.fn(),
    track: vi.fn(),
    shutdown: vi.fn(),
  }),
}));

vi.mock("../../../telemetry/events.js", () => ({
  trackCommand: vi.fn(),
}));

vi.mock("../../../utils/shared/metadata.js", () => ({
  findConnectionsWithService: vi
    .fn()
    .mockResolvedValue([{ accountId: "123456789012", region: "us-east-1" }]),
}));

// Imports after mocks so `emailPlan` and its dependencies pick up the mocked
// modules.
import * as clack from "@clack/prompts";
import * as metadata from "../../../utils/shared/metadata.js";
import { emailPlan } from "../plan.js";

const ACCOUNT_ID = "123456789012";

function defaultIdentity() {
  return {
    Account: ACCOUNT_ID,
    UserId: "AIDAI123456789",
    Arn: `arn:aws:iam::${ACCOUNT_ID}:user/test`,
  };
}

/** Pull the `email.plan` JSON envelope out of the console.log spy. */
function readJsonEnvelope(consoleLogSpy: ReturnType<typeof vi.spyOn>) {
  const call = consoleLogSpy.mock.calls.find(([arg]) => {
    if (typeof arg !== "string") {
      return false;
    }
    try {
      return JSON.parse(arg).command === "email.plan";
    } catch {
      return false;
    }
  });
  if (!call) {
    throw new Error("No email.plan JSON envelope was logged");
  }
  return JSON.parse(call[0] as string);
}

describe("email plan command", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stsMock.reset();
    sesv2Mock.reset();
    vi.clearAllMocks();

    stsMock.on(GetCallerIdentityCommand).resolves(defaultIdentity());
    vi.mocked(metadata.findConnectionsWithService).mockResolvedValue([
      { accountId: ACCOUNT_ID, region: "us-east-1" },
    ] as never);
    vi.mocked(clack.isCancel).mockReturnValue(false);

    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {
      // swallow
    });

    setJsonMode(false);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    setJsonMode(false);
  });

  it("read path recommends NONE and names the savings when current plan is ESSENTIALS, without mutating", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
      PricingAttributes: { CurrentPlan: "ESSENTIALS" },
      SendQuota: {
        Max24HourSend: 50_000,
        MaxSendRate: 14,
        SentLast24Hours: 5000,
      },
    });

    setJsonMode(true);
    await emailPlan({ json: true });

    const envelope = readJsonEnvelope(consoleLogSpy);
    expect(envelope.data.mode).toBe("read");
    const region = envelope.data.regions[0];
    expect(region.currentPlan).toBe("ESSENTIALS");
    expect(region.recommendedPlan).toBe("NONE");
    expect(region.annualSavings).toBeGreaterThan(0);

    expect(
      sesv2Mock.commandCalls(PutAccountPricingAttributesCommand)
    ).toHaveLength(0);
  });

  it("--set NONE without --yes in a non-interactive context does not mutate", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
      PricingAttributes: { CurrentPlan: "ESSENTIALS" },
    });

    await expect(emailPlan({ set: "NONE" })).rejects.toThrow();

    expect(clack.confirm).not.toHaveBeenCalled();
    expect(
      sesv2Mock.commandCalls(PutAccountPricingAttributesCommand)
    ).toHaveLength(0);
  });

  it("--set NONE --yes sends exactly one Put with { Plan: NONE } and re-reads GetAccount", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
      PricingAttributes: { CurrentPlan: "ESSENTIALS" },
      SendQuota: {
        Max24HourSend: 50_000,
        MaxSendRate: 14,
        SentLast24Hours: 5000,
      },
    });
    sesv2Mock.on(PutAccountPricingAttributesCommand).resolves({});

    await emailPlan({ set: "NONE", yes: true });

    const putCalls = sesv2Mock.commandCalls(PutAccountPricingAttributesCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input).toEqual({ Plan: "NONE" });

    // Re-reads GetAccount after the Put — once for "before", once for "after".
    expect(
      sesv2Mock.commandCalls(GetAccountCommand).length
    ).toBeGreaterThanOrEqual(2);
  });

  it("--set BOGUS rejects with a message listing the four valid values and makes no AWS call", async () => {
    let caught: unknown;
    try {
      await emailPlan({ set: "BOGUS" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = `${(caught as Error).message} ${(caught as Error & { suggestion?: string }).suggestion ?? ""}`;
    for (const plan of SES_PRICING_PLANS) {
      expect(message).toContain(plan);
    }

    expect(sesv2Mock.commandCalls(GetAccountCommand)).toHaveLength(0);
    expect(
      sesv2Mock.commandCalls(PutAccountPricingAttributesCommand)
    ).toHaveLength(0);
  });

  it("degrades to an unknown-plan result (not a crash) when PricingAttributes is absent", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
      SendQuota: {
        Max24HourSend: 50_000,
        MaxSendRate: 14,
        SentLast24Hours: 500,
      },
      // No PricingAttributes at all.
    });

    setJsonMode(true);
    await expect(emailPlan({ json: true })).resolves.toBeUndefined();

    const envelope = readJsonEnvelope(consoleLogSpy);
    expect(envelope.data.regions[0].currentPlan).toBeNull();
    // Cheapest-plan math still runs even without a known current plan.
    expect(envelope.data.regions[0].recommendedPlan).toBe("NONE");
  });

  it("surfaces an actionable access-denied message (not 'AWS credentials not found') when Put is denied", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
      PricingAttributes: { CurrentPlan: "ESSENTIALS" },
    });
    const denied = new Error("User is not authorized to perform this action");
    denied.name = "AccessDeniedException";
    sesv2Mock.on(PutAccountPricingAttributesCommand).rejects(denied);

    let caught: unknown;
    try {
      await emailPlan({ set: "NONE", yes: true });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    const message = (caught as Error).message;
    expect(message).not.toContain("AWS credentials not found");
    expect(message).toContain("ses:PutAccountPricingAttributes");
  });

  it("multi-Region + --set + non-interactive + no --region exits non-zero and sends zero Put commands", async () => {
    vi.mocked(metadata.findConnectionsWithService).mockResolvedValue([
      { accountId: ACCOUNT_ID, region: "us-east-1" },
      { accountId: ACCOUNT_ID, region: "eu-west-1" },
    ] as never);

    await expect(emailPlan({ set: "NONE", yes: true })).rejects.toThrow();

    expect(sesv2Mock.commandCalls(GetAccountCommand)).toHaveLength(0);
    expect(
      sesv2Mock.commandCalls(PutAccountPricingAttributesCommand)
    ).toHaveLength(0);
  });

  it("zero-volume read still names the current plan and recommends à la carte, without an all-$0.00 headline", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
      PricingAttributes: { CurrentPlan: "ESSENTIALS" },
      SendQuota: {
        Max24HourSend: 50_000,
        MaxSendRate: 14,
        SentLast24Hours: 0,
      },
    });

    setJsonMode(true);
    await emailPlan({ json: true });

    const envelope = readJsonEnvelope(consoleLogSpy);
    const region = envelope.data.regions[0];
    expect(region.currentPlan).toBe("ESSENTIALS");
    expect(region.recommendedPlan).toBe("NONE");
    expect(region.volumeSource).toBe("estimated");
    expect(region.emailsPerMonth).toBeGreaterThan(0);

    const essentialsRow = region.comparison.find(
      (row: { plan: string }) => row.plan === "ESSENTIALS"
    );
    expect(essentialsRow.monthlyCost).toBeGreaterThan(0);
  });
});
