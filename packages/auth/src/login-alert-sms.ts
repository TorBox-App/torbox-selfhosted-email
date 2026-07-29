/**
 * Login alert SMS — deliberately a leaf module.
 *
 * This file must NOT import the Better Auth config, the billing SDK, the DB
 * package, or the auth package's main entrypoint. Those together cost ~627ms+
 * to cold-import (see plan 152); this module's own dependencies (the AWS
 * Pinpoint SMS client, the Vercel OIDC credential provider, and
 * `@wraps.dev/sms`) cost ~118ms. Tests that only need `sendLoginAlertSms`
 * import this file directly instead of paying for the whole auth config. If a
 * future change adds one of those heavy imports here, that cost comes back —
 * treat any new import in this file as a red flag.
 */

import { PinpointSMSVoiceV2Client } from "@aws-sdk/client-pinpoint-sms-voice-v2";
import * as Sentry from "@sentry/nextjs";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { WrapsSMS } from "@wraps.dev/sms";

/**
 * Build the Pinpoint client for login alerts.
 *
 * On Vercel we must construct this ourselves. `@wraps.dev/sms` bundles a CJS
 * copy of `@vercel/oidc` into its ESM output, so its own OIDC branch throws
 * `Dynamic require of "path" is not supported` and reports it as a missing
 * dependency. Passing a pre-built `client` bypasses that branch entirely.
 * Same pattern as `packages/email/src/lib/client.ts`.
 */
function createLoginAlertSmsClient(): PinpointSMSVoiceV2Client | undefined {
  // WRAPS_SMS_ROLE_ARN is a dedicated SMS role in the dogfood account, mirroring
  // WRAPS_EMAIL_ROLE_ARN. It is not provisioned yet; until it is, this falls back
  // to AWS_ROLE_ARN (the platform hop role), which only grants sts:AssumeRole and
  // will fail with AccessDenied. That failure is now reported to Sentry rather
  // than being masked by the SDK's bundling error.
  const roleArn = process.env.WRAPS_SMS_ROLE_ARN ?? process.env.AWS_ROLE_ARN;

  if (!(process.env.VERCEL && roleArn)) {
    return;
  }

  return new PinpointSMSVoiceV2Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: awsCredentialsProvider({
      roleArn,
      roleSessionName: "wraps-sms-session",
    }),
  });
}

/**
 * Send login alert SMS when a new device or IP is detected.
 * Failures are logged and reported but don't affect auth flow.
 */
export async function sendLoginAlertSms(
  phoneNumber: string,
  details: { ipAddress?: string; userAgent?: string }
) {
  try {
    // Parse user agent for a friendly device description
    const deviceInfo = parseUserAgent(details.userAgent);

    const message = `[Wraps.dev] New login detected from ${deviceInfo}${details.ipAddress ? ` (IP: ${details.ipAddress})` : ""}. If this wasn't you, secure your account immediately.`;

    const client = createLoginAlertSmsClient();
    const sms = new WrapsSMS(client ? { client } : {});
    await sms.send({
      to: phoneNumber,
      message,
      messageType: "TRANSACTIONAL",
      // AWS End User Messaging requires an origination identity (phone number,
      // pool, or sender ID). None is provisioned for Wraps' own account yet, so
      // this is undefined today and AWS rejects the send.
      from: process.env.WRAPS_SMS_ORIGINATION_IDENTITY,
    });

    console.info(
      JSON.stringify({
        msg: "Login alert SMS sent",
        phone: `${phoneNumber.slice(0, 6)}***`,
      })
    );
  } catch (error) {
    console.error("Failed to send login alert SMS:", error);
    Sentry.captureException(error, {
      tags: { feature: "login-alert-sms" },
    });
  }
}

/**
 * Parse user agent string into a friendly device description.
 */
function parseUserAgent(userAgent?: string): string {
  if (!userAgent) {
    return "unknown device";
  }

  // Simple parsing - could use a library like ua-parser-js for more detail
  if (userAgent.includes("iPhone")) {
    return "iPhone";
  }
  if (userAgent.includes("iPad")) {
    return "iPad";
  }
  if (userAgent.includes("Android")) {
    return "Android device";
  }
  if (userAgent.includes("Mac")) {
    return "Mac";
  }
  if (userAgent.includes("Windows")) {
    return "Windows PC";
  }
  if (userAgent.includes("Linux")) {
    return "Linux";
  }
  if (userAgent.includes("Chrome")) {
    return "Chrome browser";
  }
  if (userAgent.includes("Firefox")) {
    return "Firefox browser";
  }
  if (userAgent.includes("Safari")) {
    return "Safari browser";
  }

  return "new device";
}
