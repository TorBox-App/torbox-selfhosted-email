/**
 * Login Alert SMS — Vercel OIDC Credential Resolution
 *
 * Reproduces the production bug where `/api/auth` logs
 * "Failed to send login alert SMS: ... On Vercel with roleArn requires
 * @vercel/oidc-aws-credentials-provider".
 *
 * `sendLoginAlertSms` constructs a bare `new WrapsSMS()`, which delegates
 * Vercel OIDC credential resolution to the SDK's internal dynamic-import
 * path. That path is not usable from the deployed bundle, so credential
 * resolution throws and the SMS is silently dropped inside the `after()`
 * hook.
 *
 * The working pattern already exists in `packages/email/src/lib/client.ts`
 * and `apps/web/src/lib/aws/assume-role.ts`: import `awsCredentialsProvider`
 * directly and hand the SDK a pre-built client.
 *
 * Boundaries mocked (and nothing else):
 *   - `@vercel/oidc-aws-credentials-provider` — Vercel's OIDC token exchange
 *   - `@aws-sdk/client-pinpoint-sms-voice-v2` — the AWS network call
 *   - `@sentry/nextjs`                        — error reporting
 *   - `process.env`                           — the Vercel OIDC environment
 */

import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendLoginAlertSms } from "../login-alert-sms";

const sentCommands: unknown[] = [];
const oidcCallArgs: unknown[] = [];

// Set by an individual test to make the next `send()` call reject, simulating
// an AWS API failure. Reset to `null` in `beforeEach`.
let sendRejection: Error | null = null;

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@vercel/oidc-aws-credentials-provider", () => ({
  awsCredentialsProvider: vi.fn((args: unknown) => {
    oidcCallArgs.push(args);
    return async () => ({
      accessKeyId: "ASIAOIDCTEST",
      secretAccessKey: "oidc-secret",
      sessionToken: "oidc-session-token",
      expiration: new Date(Date.now() + 3_600_000),
    });
  }),
}));

vi.mock("@aws-sdk/client-pinpoint-sms-voice-v2", () => {
  class SendTextMessageCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class PinpointSMSVoiceV2Client {
    config: { credentials?: unknown };
    constructor(config: { credentials?: unknown }) {
      this.config = config;
    }
    async send(command: { input?: unknown }) {
      // Faithfully exercise credential resolution the way the real client
      // does before it puts anything on the wire.
      const creds = this.config.credentials;
      if (typeof creds === "function") {
        await (creds as () => Promise<unknown>)();
      }
      if (sendRejection) {
        throw sendRejection;
      }
      sentCommands.push(command.input);
      return { MessageId: "test-message-id" };
    }
  }
  return { PinpointSMSVoiceV2Client, SendTextMessageCommand };
});

const PHONE = "+15551230000";
const ROLE_ARN = "arn:aws:iam::111122223333:role/wraps-sms-role";

describe("sendLoginAlertSms on Vercel with OIDC", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sentCommands.length = 0;
    oidcCallArgs.length = 0;
    sendRejection = null;
    vi.mocked(Sentry.captureException).mockClear();
    // Simulate a Vercel serverless function with OIDC role assumption.
    process.env.VERCEL = "1";
    process.env.AWS_ROLE_ARN = ROLE_ARN;
    process.env.AWS_REGION = "us-east-1";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // swallow — asserted on below
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    process.env = { ...originalEnv };
  });

  it("delivers the SMS when a new device is detected", async () => {
    await sendLoginAlertSms(PHONE, {
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });

    // The bug swallows the credential failure here, so surface it in the
    // failure output rather than reporting a bare "expected 1, got 0".
    const loggedFailure = errorSpy.mock.calls.find(
      (call: unknown[]) => call[0] === "Failed to send login alert SMS:"
    );
    expect(
      loggedFailure ? String(loggedFailure[1]) : undefined
    ).toBeUndefined();

    expect(sentCommands).toHaveLength(1);
    expect(sentCommands[0]).toMatchObject({
      DestinationPhoneNumber: PHONE,
      MessageType: "TRANSACTIONAL",
    });
    expect((sentCommands[0] as { MessageBody: string }).MessageBody).toContain(
      "iPhone"
    );
    expect((sentCommands[0] as { MessageBody: string }).MessageBody).toContain(
      "203.0.113.7"
    );

    // Credentials must come from Vercel's OIDC provider, not the SDK's
    // internal dynamic-import fallback.
    expect(oidcCallArgs).toHaveLength(1);
    expect(oidcCallArgs[0]).toMatchObject({ roleArn: ROLE_ARN });
  });

  it("assumes the dedicated SMS role rather than the platform hop role", async () => {
    // AWS_ROLE_ARN is the platform role whose only permission is sts:AssumeRole
    // (cloudformation/vercel-oidc-role.yaml). Sending SMS with it yields
    // AccessDenied, so a dedicated role must win when it is provisioned.
    const smsRoleArn = "arn:aws:iam::010836206701:role/wraps-sms-role";
    process.env.WRAPS_SMS_ROLE_ARN = smsRoleArn;

    await sendLoginAlertSms(PHONE, { ipAddress: "203.0.113.7" });

    expect(oidcCallArgs).toHaveLength(1);
    expect(oidcCallArgs[0]).toMatchObject({ roleArn: smsRoleArn });
  });

  it("sends the configured origination identity to AWS", async () => {
    // AWS End User Messaging rejects a send with no OriginationIdentity.
    process.env.WRAPS_SMS_ORIGINATION_IDENTITY = "+15550001111";

    await sendLoginAlertSms(PHONE, { ipAddress: "203.0.113.7" });

    expect(sentCommands).toHaveLength(1);
    expect(sentCommands[0]).toMatchObject({
      OriginationIdentity: "+15550001111",
    });
  });

  it("describes an undefined user agent as an unknown device", async () => {
    await sendLoginAlertSms(PHONE, { ipAddress: "203.0.113.7" });

    expect((sentCommands[0] as { MessageBody: string }).MessageBody).toContain(
      "unknown device"
    );
  });

  it("describes an unrecognized user agent as a new device", async () => {
    await sendLoginAlertSms(PHONE, {
      ipAddress: "203.0.113.7",
      userAgent: "curl/8.4.0",
    });

    expect((sentCommands[0] as { MessageBody: string }).MessageBody).toContain(
      "new device"
    );
  });

  it("describes a macOS Safari user agent as Mac, not Safari browser", async () => {
    // Pins the branch-order dependency in parseUserAgent: the Mac check must
    // run before the Safari check, since Safari UA strings contain "Mac".
    await sendLoginAlertSms(PHONE, {
      ipAddress: "203.0.113.7",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    });

    const body = (sentCommands[0] as { MessageBody: string }).MessageBody;
    expect(body).toContain("Mac");
    expect(body).not.toContain("Safari browser");
  });

  it("describes an Android user agent as an Android device", async () => {
    await sendLoginAlertSms(PHONE, {
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    });

    expect((sentCommands[0] as { MessageBody: string }).MessageBody).toContain(
      "Android device"
    );
  });

  it("omits the IP suffix when no ipAddress is supplied", async () => {
    await sendLoginAlertSms(PHONE, {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });

    expect(
      (sentCommands[0] as { MessageBody: string }).MessageBody
    ).not.toContain("(IP:");
  });

  it("swallows a failed send and reports it to Sentry instead of throwing", async () => {
    sendRejection = new Error("AccessDeniedException");

    await expect(
      sendLoginAlertSms(PHONE, { ipAddress: "203.0.113.7" })
    ).resolves.toBeUndefined();

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      sendRejection,
      expect.objectContaining({ tags: { feature: "login-alert-sms" } })
    );
  });
});
