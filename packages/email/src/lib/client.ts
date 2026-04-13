import { SESClient } from "@aws-sdk/client-ses";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { WrapsEmail } from "@wraps.dev/email";

/**
 * Create SES client for production (Vercel):
 * Uses Vercel OIDC to assume the email role directly.
 * The dogfood account's wraps-email-role trusts the Vercel OIDC provider
 * via AssumeRoleWithWebIdentity — no intermediary backend role needed.
 */
function createProductionSESClient(): SESClient {
  const region = process.env.AWS_REGION || "us-east-1";

  return new SESClient({
    region,
    credentials: awsCredentialsProvider({
      roleArn: process.env.WRAPS_EMAIL_ROLE_ARN!,
    }),
  });
}

/**
 * Get a properly configured WrapsEmail client instance
 *
 * In development: Uses standard AWS credential chain (env vars, profiles, etc.)
 * In production: Uses Vercel OIDC to assume the email role directly
 *
 * @example
 * ```ts
 * const wraps = await getWrapsClient();
 * await wraps.send({ from, to, subject, html, text });
 * await wraps.sendTemplate({ from, to, template, templateData });
 * ```
 */
export async function getWrapsClient(): Promise<WrapsEmail> {
  const region = process.env.AWS_REGION || "us-east-1";

  const isProduction =
    process.env.VERCEL === "1" && process.env.WRAPS_EMAIL_ROLE_ARN;

  return isProduction
    ? new WrapsEmail({ client: createProductionSESClient() })
    : new WrapsEmail({
        region,
        roleArn: process.env.WRAPS_EMAIL_ROLE_ARN,
      });
}

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Send an email using the Wraps Email SDK
 *
 * In development: Uses standard AWS credential chain (env vars, profiles, etc.)
 * In production: Uses Vercel OIDC to assume the email role directly
 *
 * @example
 * ```ts
 * await sendEmail({
 *   to: "user@example.com",
 *   subject: "Welcome!",
 *   html: "<h1>Hello!</h1>",
 *   text: "Hello!"
 * });
 * ```
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const from = process.env.EMAIL_FROM || "Wraps <hello@wraps.dev>";

  const wraps = await getWrapsClient();

  // Send email using Wraps SDK
  const result = await wraps.send({
    from,
    to,
    subject,
    html,
    text,
  });

  return {
    success: true,
    messageId: result.messageId,
  };
}
