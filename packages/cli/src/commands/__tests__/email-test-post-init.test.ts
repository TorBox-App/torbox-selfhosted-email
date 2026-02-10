/**
 * Test reproducing the bug where `wraps email init` post-deploy test email
 * fails with "Email address is not verified" when sending to the SES simulator.
 *
 * Bug: After `wraps email init` deploys, the domain identity (e.g., example.com)
 * is created in SES but is still in PENDING verification state because DKIM DNS
 * records haven't propagated yet. The test email sends from `test@example.com`
 * to `success@simulator.amazonses.com`. SES rejects the send because the FROM
 * domain is not verified — NOT because of the TO address.
 *
 * The error handler then misleadingly suggests using simulator addresses, but
 * the user is already sending TO a simulator address. The real problem is the
 * unverified FROM domain.
 */
import {
  GetEmailIdentityCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailTest } from "../email/test.js";

const sesv2Mock = mockClient(SESv2Client);

// Mock clack
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  log: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    step: vi.fn(),
  },
  note: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

// Mock metadata module
vi.mock("../../utils/shared/metadata.js", () => ({
  loadConnectionMetadata: vi.fn().mockResolvedValue(null),
}));

// Mock telemetry
vi.mock("../../telemetry/events.js", () => ({
  trackCommand: vi.fn(),
  trackError: vi.fn(),
}));

// Mock AWS utilities
vi.mock("../../utils/shared/aws.js", () => ({
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    userId: "AIDAI123456789",
    arn: "arn:aws:iam::123456789012:user/test",
  }),
}));

// Mock verification utilities
vi.mock("../../utils/email/verification.js", () => ({
  pollDomainVerification: vi.fn().mockResolvedValue(true),
  verifySandboxRecipient: vi
    .fn()
    .mockResolvedValue({ verified: true, email: "user@example.com" }),
}));

const FRESHLY_DEPLOYED_METADATA = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: new Date().toISOString(),
  services: {
    email: {
      config: {
        domain: "mynewapp.com",
        sendingEnabled: true,
        tracking: { enabled: true },
      },
      preset: "starter" as const,
      deployedAt: new Date().toISOString(),
      pulumiStackName: "wraps-123456789012-us-east-1",
    },
  },
};

describe("post-init test email bug: unverified FROM domain", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sesv2Mock.reset();
    vi.clearAllMocks();

    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("should show domain verification guidance when FROM domain is unverified", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(
      FRESHLY_DEPLOYED_METADATA
    );

    // Domain is not yet verified in SES
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: false,
      DkimAttributes: { Status: "PENDING" },
    });

    const clack = await import("@clack/prompts");

    await emailTest({
      to: "success@simulator.amazonses.com",
      region: "us-east-1",
    });

    // Should NOT attempt to send when domain is unverified
    const sendCalls = sesv2Mock.commandCalls(SendEmailCommand);
    expect(sendCalls).toHaveLength(0);

    // Should show domain-specific guidance
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining("domain")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should send successfully when domain IS verified", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(
      FRESHLY_DEPLOYED_METADATA
    );

    // Domain is verified
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: true,
      DkimAttributes: { Status: "SUCCESS" },
    });

    sesv2Mock.on(SendEmailCommand).resolves({
      MessageId: "test-message-id-123",
    });

    await emailTest({
      to: "success@simulator.amazonses.com",
      region: "us-east-1",
    });

    const sendCalls = sesv2Mock.commandCalls(SendEmailCommand);
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0].args[0].input.FromEmailAddress).toBe(
      "test@mynewapp.com"
    );
  });

  it("should show FROM domain guidance (not recipient guidance) when SES rejects for unverified sender", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(
      FRESHLY_DEPLOYED_METADATA
    );

    // Domain appears verified (race condition: check passes, send fails)
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: true,
      DkimAttributes: { Status: "SUCCESS" },
    });

    // SES still rejects with FROM identity failure
    const sesError = new Error(
      "Email address is not verified. The following identities failed the check in region US-EAST-1: test@mynewapp.com"
    );
    sesError.name = "MessageRejected";
    sesv2Mock.on(SendEmailCommand).rejects(sesError);

    const clack = await import("@clack/prompts");

    await emailTest({
      to: "success@simulator.amazonses.com",
      region: "us-east-1",
    });

    // Should show domain verification guidance, NOT "use simulator addresses"
    const consoleOutput = consoleLogSpy.mock.calls
      .map((call) => String(call[0] || ""))
      .join("\n");
    expect(consoleOutput).toContain("domain");
    expect(consoleOutput).not.toContain("Simulator addresses always work");

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should still show recipient guidance when TO address is genuinely unverified", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(
      FRESHLY_DEPLOYED_METADATA
    );

    // Domain is verified
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: true,
      DkimAttributes: { Status: "SUCCESS" },
    });

    // SES rejects because recipient isn't verified (sandbox mode)
    const sesError = new Error(
      "Email address is not verified. The following identities failed the check in region US-EAST-1: user@unverified.com"
    );
    sesError.name = "MessageRejected";
    sesv2Mock.on(SendEmailCommand).rejects(sesError);

    const clack = await import("@clack/prompts");

    await emailTest({
      to: "user@unverified.com",
      region: "us-east-1",
    });

    // Should show recipient-specific guidance with simulator suggestion
    expect(clack.log.error).toHaveBeenCalledWith(
      "Email address is not verified"
    );
    const consoleOutput = consoleLogSpy.mock.calls
      .map((call) => String(call[0] || ""))
      .join("\n");
    expect(consoleOutput).toContain("simulator.amazonses.com");

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("postDeploy: polls DNS instead of hard exit when domain unverified", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(
      FRESHLY_DEPLOYED_METADATA
    );

    const clack = await import("@clack/prompts");
    vi.mocked(clack.confirm).mockResolvedValue(true);

    // Domain starts unverified
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: false,
      DkimAttributes: { Status: "PENDING" },
    });

    const { pollDomainVerification } = await import(
      "../../utils/email/verification.js"
    );
    vi.mocked(pollDomainVerification).mockResolvedValue(true);

    sesv2Mock.on(SendEmailCommand).resolves({
      MessageId: "post-init-verified-id",
    });

    await emailTest({
      to: "success@simulator.amazonses.com",
      region: "us-east-1",
      postDeploy: true,
    });

    // Should have polled for verification
    expect(pollDomainVerification).toHaveBeenCalledWith(
      "mynewapp.com",
      "us-east-1"
    );

    // Should have proceeded to send
    const sendCalls = sesv2Mock.commandCalls(SendEmailCommand);
    expect(sendCalls).toHaveLength(1);

    // Should NOT have called process.exit
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("postDeploy: graceful return when DNS polling times out", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(
      FRESHLY_DEPLOYED_METADATA
    );

    const clack = await import("@clack/prompts");
    vi.mocked(clack.confirm).mockResolvedValue(true);

    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: false,
      DkimAttributes: { Status: "PENDING" },
    });

    const { pollDomainVerification } = await import(
      "../../utils/email/verification.js"
    );
    vi.mocked(pollDomainVerification).mockResolvedValue(false);

    await emailTest({
      to: "success@simulator.amazonses.com",
      region: "us-east-1",
      postDeploy: true,
    });

    // Should NOT have called process.exit (graceful return)
    expect(exitSpy).not.toHaveBeenCalled();

    // Should NOT have attempted to send
    const sendCalls = sesv2Mock.commandCalls(SendEmailCommand);
    expect(sendCalls).toHaveLength(0);
  });
});
