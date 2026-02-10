import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
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

const MOCK_METADATA = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2024-01-01T00:00:00.000Z",
  services: {
    email: {
      config: {
        domain: "example.com",
        sendingEnabled: true,
      },
      preset: "starter" as const,
      deployedAt: "2024-01-01T00:00:00.000Z",
    },
  },
};

describe("email test command", () => {
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

  it("should send test email with simulator address via --to flag", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(MOCK_METADATA);

    sesv2Mock.on(SendEmailCommand).resolves({
      MessageId: "test-message-id-123",
    });

    await emailTest({
      to: "success@simulator.amazonses.com",
    });

    // Verify SES was called with correct params
    const calls = sesv2Mock.commandCalls(SendEmailCommand);
    expect(calls).toHaveLength(1);

    const input = calls[0].args[0].input;
    expect(input.FromEmailAddress).toBe("test@example.com");
    expect(input.Destination?.ToAddresses).toEqual([
      "success@simulator.amazonses.com",
    ]);
    expect(input.ConfigurationSetName).toBe("wraps-email-tracking");
    expect(input.Content?.Simple?.Subject?.Data).toBe("Test email from Wraps");
  });

  it("should send test email with --scenario flag", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(MOCK_METADATA);

    sesv2Mock.on(SendEmailCommand).resolves({
      MessageId: "test-bounce-id-456",
    });

    await emailTest({
      scenario: "bounce",
    });

    const calls = sesv2Mock.commandCalls(SendEmailCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Destination?.ToAddresses).toEqual([
      "bounce@simulator.amazonses.com",
    ]);
  });

  it("should exit with error when no email infrastructure found", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(null);

    await emailTest({ to: "success@simulator.amazonses.com" });

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should exit with error when metadata has no email service", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue({
      ...MOCK_METADATA,
      services: {},
    });

    await emailTest({ to: "success@simulator.amazonses.com" });

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should handle MessageRejected error for unverified address", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(MOCK_METADATA);

    const error = new Error(
      "Email address is not verified. The following identities failed the check in region US-EAST-1: user@unverified.com"
    );
    error.name = "MessageRejected";
    sesv2Mock.on(SendEmailCommand).rejects(error);

    const clack = await import("@clack/prompts");

    await emailTest({ to: "user@unverified.com" });

    expect(clack.log.error).toHaveBeenCalledWith(
      "Email address is not verified"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should handle MailFromDomainNotVerifiedException", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(MOCK_METADATA);

    const error = new Error("Mail from domain not verified");
    error.name = "MailFromDomainNotVerifiedException";
    sesv2Mock.on(SendEmailCommand).rejects(error);

    const clack = await import("@clack/prompts");

    await emailTest({ to: "success@simulator.amazonses.com" });

    expect(clack.log.error).toHaveBeenCalledWith(
      "Sending domain is not verified"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should track telemetry on success", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(MOCK_METADATA);

    sesv2Mock.on(SendEmailCommand).resolves({
      MessageId: "test-id",
    });

    const { trackCommand } = await import("../../telemetry/events.js");

    await emailTest({ to: "success@simulator.amazonses.com" });

    expect(trackCommand).toHaveBeenCalledWith(
      "email:test",
      expect.objectContaining({
        success: true,
        is_simulator: true,
      })
    );
  });

  it("should track telemetry on failure", async () => {
    const { loadConnectionMetadata } = await import(
      "../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(MOCK_METADATA);

    sesv2Mock.on(SendEmailCommand).rejects(new Error("Some SES error"));

    const { trackError, trackCommand } = await import(
      "../../telemetry/events.js"
    );

    await emailTest({ to: "success@simulator.amazonses.com" });

    expect(trackError).toHaveBeenCalledWith(
      "EMAIL_SEND_FAILED",
      "email:test",
      expect.objectContaining({ error: "Some SES error" })
    );
    expect(trackCommand).toHaveBeenCalledWith(
      "email:test",
      expect.objectContaining({ success: false })
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
