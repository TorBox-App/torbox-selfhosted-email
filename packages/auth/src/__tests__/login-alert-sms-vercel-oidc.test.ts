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
 *   - `process.env`                           — the Vercel OIDC environment
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const sentCommands: unknown[] = [];
const oidcCallArgs: unknown[] = [];

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
  let sendLoginAlertSms: typeof import("../index").sendLoginAlertSms;
  const originalEnv = { ...process.env };

  // `../index` pulls in better-auth, Stripe and the DB layer — a cold import
  // costs seconds. Importing it inside a test body puts that on the 5s test
  // timeout, which blows up under the parallel load of the full suite. Every
  // env var this module reads is read at call time, so hoisting is safe.
  beforeAll(async () => {
    ({ sendLoginAlertSms } = await import("../index"));
  }, 60_000);

  beforeEach(() => {
    sentCommands.length = 0;
    oidcCallArgs.length = 0;
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
});
