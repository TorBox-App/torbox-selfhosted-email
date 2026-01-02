/**
 * Topic Subscription Confirmation Email
 *
 * Sent when a contact subscribes to a topic that requires double opt-in.
 */

export type SendTopicConfirmationEmailParams = {
  to: string;
  url: string;
  topicName: string;
  topicDescription?: string | null;
  organizationName?: string;
};

/**
 * Generate topic confirmation email HTML and text
 */
export function generateTopicConfirmationEmail({
  url,
  topicName,
  topicDescription,
  organizationName,
}: Omit<SendTopicConfirmationEmailParams, "to">): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Confirm your subscription to ${topicName}`;
  const orgDisplay = organizationName || "this organization";

  const htmlBody = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your subscription</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #000000; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Confirm Your Subscription</h1>
    </div>

    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>

      <p style="font-size: 16px; margin-bottom: 20px;">
        You've requested to subscribe to <strong>${topicName}</strong> from ${orgDisplay}.
      </p>

      ${
        topicDescription
          ? `<p style="font-size: 14px; color: #6b7280; margin-bottom: 20px; padding: 12px; background: #f9fafb; border-radius: 6px;">
        ${topicDescription}
      </p>`
          : ""
      }

      <p style="font-size: 16px; margin-bottom: 20px;">
        Please click the button below to confirm your subscription:
      </p>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${url}" style="display: inline-block; background: #000000; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Confirm Subscription
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="font-size: 14px; color: #333333; word-break: break-all; background: #f9fafb; padding: 12px; border-radius: 6px;">
        ${url}
      </p>

      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-top: 30px; border-left: 4px solid #000000;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          <strong>Note:</strong> This confirmation link will expire in 48 hours. If you didn't request this subscription, you can safely ignore this email.
        </p>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
      <p>
        This email was sent by ${orgDisplay}.
      </p>
    </div>
  </body>
</html>`;

  const textBody = `Confirm Your Subscription

Hi there,

You've requested to subscribe to ${topicName} from ${orgDisplay}.

${topicDescription ? `About this topic: ${topicDescription}\n` : ""}
Please click the link below to confirm your subscription:
${url}

Note: This confirmation link will expire in 48 hours. If you didn't request this subscription, you can safely ignore this email.

---
This email was sent by ${orgDisplay}.`;

  return { subject, html: htmlBody, text: textBody };
}
