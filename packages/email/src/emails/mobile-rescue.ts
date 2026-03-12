import { sendEmail } from "../lib/client";

export type SendMobileRescueEmailParams = {
  to: string;
  dashboardUrl: string;
  orgName: string;
};

export async function sendMobileRescueEmail({
  to,
  dashboardUrl,
  orgName,
}: SendMobileRescueEmailParams) {
  const htmlBody = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Continue on your computer</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Continue on Your Computer</h1>
    </div>

    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>

      <p style="font-size: 16px; margin-bottom: 20px;">
        Your organization <strong>${orgName}</strong> has been created! To finish setting up, you'll connect your AWS account and start sending emails from your desktop.
      </p>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Continue Setup
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="font-size: 14px; color: #667eea; word-break: break-all; background: #f9fafb; padding: 12px; border-radius: 6px;">
        ${dashboardUrl}
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
      <p>
        This email was sent by Wraps. If you have any questions, please contact us at
        <a href="mailto:support@wraps.dev" style="color: #667eea; text-decoration: none;">support@wraps.dev</a>
      </p>
    </div>
  </body>
</html>`;

  const textBody = `Continue on Your Computer

Your organization ${orgName} has been created! To finish setting up, you'll connect your AWS account and start sending emails from your desktop.

Open this link on your computer to continue:
${dashboardUrl}

---
This email was sent by Wraps. If you have any questions, please contact us at support@wraps.dev`;

  return sendEmail({
    to,
    subject: `Continue setting up ${orgName} on your computer`,
    html: htmlBody,
    text: textBody,
  });
}
