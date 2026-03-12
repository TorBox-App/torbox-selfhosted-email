import { sendEmail } from "../lib/client";

export type WorkspaceContext = {
  templateCount: number;
  contactCount: number;
  hasAwsAccount: boolean;
  verifiedDomains: string[];
  hasSentEmail: boolean;
};

export type RenderInvitationEmailParams = {
  inviteLink: string;
  declineLink: string;
  organizationName: string;
  inviterName: string;
  role: string;
  workspaceContext?: WorkspaceContext;
};

export type SendInvitationEmailParams = RenderInvitationEmailParams & {
  to: string;
};

function renderWorkspaceContextHtml(
  inviterName: string,
  ctx: WorkspaceContext
): string {
  const items: string[] = [];

  if (ctx.templateCount > 0) {
    items.push(
      `${ctx.templateCount} email template${ctx.templateCount === 1 ? "" : "s"}`
    );
  }
  if (ctx.contactCount > 0) {
    items.push(
      `${ctx.contactCount} contact${ctx.contactCount === 1 ? "" : "s"}`
    );
  }
  if (ctx.hasAwsAccount) {
    items.push("AWS connected");
  }
  if (ctx.verifiedDomains.length > 0) {
    items.push(
      `${ctx.verifiedDomains.length} verified domain${ctx.verifiedDomains.length === 1 ? "" : "s"} (${ctx.verifiedDomains.join(", ")})`
    );
  }

  let html = `<div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea;">
        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Here's what ${inviterName} has set up so far:</p>
        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; color: #6b7280;">`;

  for (const item of items) {
    html += `\n          <li style="margin-bottom: 4px;">${item}</li>`;
  }

  html += "\n        </ul>";

  if (!ctx.hasAwsAccount) {
    html += `\n        <p style="margin: 12px 0 0 0; font-size: 14px; color: #92400e; background: #fffbeb; padding: 8px 12px; border-radius: 4px;">AWS infrastructure hasn't been connected yet — your help may be needed to deploy.</p>`;
  }

  html += "\n      </div>";
  return html;
}

function renderWorkspaceContextText(
  inviterName: string,
  ctx: WorkspaceContext
): string {
  const items: string[] = [];

  if (ctx.templateCount > 0) {
    items.push(
      `- ${ctx.templateCount} email template${ctx.templateCount === 1 ? "" : "s"}`
    );
  }
  if (ctx.contactCount > 0) {
    items.push(
      `- ${ctx.contactCount} contact${ctx.contactCount === 1 ? "" : "s"}`
    );
  }
  if (ctx.hasAwsAccount) {
    items.push("- AWS connected");
  }
  if (ctx.verifiedDomains.length > 0) {
    items.push(
      `- ${ctx.verifiedDomains.length} verified domain${ctx.verifiedDomains.length === 1 ? "" : "s"} (${ctx.verifiedDomains.join(", ")})`
    );
  }

  let text = `\nHere's what ${inviterName} has set up so far:\n${items.join("\n")}`;

  if (!ctx.hasAwsAccount) {
    text += `\n\nAWS infrastructure hasn't been connected yet — your help may be needed to deploy.`;
  }

  return text;
}

export function renderInvitationEmail(params: RenderInvitationEmailParams): {
  html: string;
  text: string;
} {
  const {
    inviteLink,
    declineLink,
    organizationName,
    inviterName,
    role,
    workspaceContext,
  } = params;

  const contextHtml = workspaceContext
    ? renderWorkspaceContextHtml(inviterName, workspaceContext)
    : "";

  const contextText = workspaceContext
    ? renderWorkspaceContextText(inviterName, workspaceContext)
    : "";

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${organizationName} on Wraps</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited</h1>
    </div>

    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>

      <p style="font-size: 16px; margin-bottom: 20px;">
        <strong>${inviterName}</strong> invited you to join <strong>${organizationName}</strong> on Wraps as ${role === "admin" ? "an" : "a"} <strong>${role}</strong>.
      </p>

      ${contextHtml}

      <div style="text-align: center; margin: 40px 0;">
        <a href="${inviteLink}" style="display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>

      <p style="text-align: center; font-size: 14px; color: #6b7280;">
        <a href="${declineLink}" style="color: #6b7280; text-decoration: underline;">Decline this invitation</a>
      </p>

      <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 30px;">
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">
          This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore it.
        </p>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
      <p>
        This email was sent by Wraps. If you have any questions, please contact us at
        <a href="mailto:support@wraps.dev" style="color: #667eea; text-decoration: none;">support@wraps.dev</a>
      </p>
    </div>
  </body>
</html>`;

  const text = `You're Invited to ${organizationName}

${inviterName} invited you to join ${organizationName} on Wraps as ${role === "admin" ? "an" : "a"} ${role}.
${contextText}

Accept the invitation:
${inviteLink}

Decline the invitation:
${declineLink}

This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore it.

---
This email was sent by Wraps. If you have any questions, please contact us at support@wraps.dev`;

  return { html, text };
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { to, ...renderParams } = params;
  const { html, text } = renderInvitationEmail(renderParams);

  return sendEmail({
    to,
    subject: `Join ${params.organizationName} on Wraps`,
    html,
    text,
  });
}
