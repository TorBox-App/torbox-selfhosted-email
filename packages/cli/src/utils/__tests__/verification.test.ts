import {
  GetIdentityVerificationAttributesCommand,
  SESClient,
  VerifyEmailIdentityCommand,
} from "@aws-sdk/client-ses";
import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkDomainSendingStatus,
  pollDomainVerification,
  verifySandboxRecipient,
} from "../email/verification.js";

const sesv2Mock = mockClient(SESv2Client);
const sesMock = mockClient(SESClient);

// Mock clack
vi.mock("@clack/prompts", () => ({
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("checkDomainSendingStatus", () => {
  beforeEach(() => {
    sesv2Mock.reset();
  });

  it("should return verified true when domain is verified", async () => {
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: true,
      DkimAttributes: { Status: "SUCCESS" },
    });

    const result = await checkDomainSendingStatus("example.com", "us-east-1");
    expect(result.verified).toBe(true);
    expect(result.dkimStatus).toBe("SUCCESS");
  });

  it("should return verified false when domain is not verified", async () => {
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: false,
      DkimAttributes: { Status: "PENDING" },
    });

    const result = await checkDomainSendingStatus("example.com", "us-east-1");
    expect(result.verified).toBe(false);
    expect(result.dkimStatus).toBe("PENDING");
  });

  it("should default dkimStatus to PENDING when missing", async () => {
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: false,
    });

    const result = await checkDomainSendingStatus("example.com", "us-east-1");
    expect(result.dkimStatus).toBe("PENDING");
  });
});

describe("pollDomainVerification", () => {
  beforeEach(() => {
    sesv2Mock.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return true when verification succeeds", async () => {
    // First call: not verified, second call: verified
    sesv2Mock
      .on(GetEmailIdentityCommand)
      .resolvesOnce({
        VerifiedForSendingStatus: false,
        DkimAttributes: { Status: "PENDING" },
      })
      .resolvesOnce({
        VerifiedForSendingStatus: true,
        DkimAttributes: { Status: "SUCCESS" },
      });

    const promise = pollDomainVerification("example.com", "us-east-1", {
      intervalMs: 100,
      timeoutMs: 5000,
    });

    // Advance through first poll interval
    await vi.advanceTimersByTimeAsync(100);
    // Advance through second poll interval
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe(true);
  });

  it("should return false on timeout", async () => {
    // Always return not verified
    sesv2Mock.on(GetEmailIdentityCommand).resolves({
      VerifiedForSendingStatus: false,
      DkimAttributes: { Status: "PENDING" },
    });

    const promise = pollDomainVerification("example.com", "us-east-1", {
      intervalMs: 100,
      timeoutMs: 350,
    });

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe(false);
  });
});

describe("verifySandboxRecipient", () => {
  beforeEach(() => {
    sesMock.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should send verification email and return true when confirmed", async () => {
    sesMock.on(VerifyEmailIdentityCommand).resolves({});
    sesMock
      .on(GetIdentityVerificationAttributesCommand)
      .resolvesOnce({
        VerificationAttributes: {
          "user@example.com": { VerificationStatus: "Pending" },
        },
      })
      .resolvesOnce({
        VerificationAttributes: {
          "user@example.com": { VerificationStatus: "Success" },
        },
      });

    const promise = verifySandboxRecipient("user@example.com", "us-east-1", {
      intervalMs: 100,
      timeoutMs: 5000,
    });

    // Advance through first poll
    await vi.advanceTimersByTimeAsync(100);
    // Advance through second poll
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result.verified).toBe(true);
    expect(result.email).toBe("user@example.com");

    // Verify that VerifyEmailIdentityCommand was sent
    const verifyCalls = sesMock.commandCalls(VerifyEmailIdentityCommand);
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0].args[0].input.EmailAddress).toBe("user@example.com");
  });

  it("should return false on timeout", async () => {
    sesMock.on(VerifyEmailIdentityCommand).resolves({});
    sesMock.on(GetIdentityVerificationAttributesCommand).resolves({
      VerificationAttributes: {
        "user@example.com": { VerificationStatus: "Pending" },
      },
    });

    const promise = verifySandboxRecipient("user@example.com", "us-east-1", {
      intervalMs: 100,
      timeoutMs: 350,
    });

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result.verified).toBe(false);
    expect(result.email).toBe("user@example.com");
  });

  it("should return error when initial verification email fails to send", async () => {
    sesMock.on(VerifyEmailIdentityCommand).rejects(new Error("Access denied"));

    const result = await verifySandboxRecipient(
      "user@example.com",
      "us-east-1",
      { intervalMs: 100, timeoutMs: 5000 }
    );

    expect(result.verified).toBe(false);
    expect(result.email).toBe("user@example.com");
    expect(result.error).toBe("Access denied");

    // Should NOT have attempted to poll
    const pollCalls = sesMock.commandCalls(
      GetIdentityVerificationAttributesCommand
    );
    expect(pollCalls).toHaveLength(0);
  });
});
