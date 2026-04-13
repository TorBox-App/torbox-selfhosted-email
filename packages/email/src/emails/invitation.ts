import { getWrapsClient } from "../lib/client";

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

/**
 * Build workspace context as HTML list items for the SES template.
 * Returns empty string if no items to show.
 */
function buildWorkspaceItemsHtml(ctx: WorkspaceContext): string {
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

  if (items.length === 0) {
    return "";
  }

  return items
    .map((item) => `<li style="margin-bottom:4px;">${item}</li>`)
    .join("");
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { to, workspaceContext, ...rest } = params;

  const workspaceItemsHtml = workspaceContext
    ? buildWorkspaceItemsHtml(workspaceContext)
    : "";

  const wraps = await getWrapsClient();

  return wraps.sendTemplate({
    from: process.env.EMAIL_FROM || "Wraps <hello@wraps.dev>",
    to,
    template: "team-invitation",
    templateData: {
      inviterName: rest.inviterName,
      organizationName: rest.organizationName,
      role: rest.role,
      roleArticle: rest.role === "admin" ? "an" : "a",
      inviteLink: rest.inviteLink,
      declineLink: rest.declineLink,
      workspaceItemsHtml,
      showAwsWarning: workspaceContext
        ? !workspaceContext.hasAwsAccount
        : false,
    },
  });
}

/**
 * Render invitation email HTML (for preview/testing).
 * @deprecated Use sendInvitationEmail which delegates to SES template.
 */
export function renderInvitationEmail(params: RenderInvitationEmailParams): {
  html: string;
  text: string;
} {
  const { inviteLink, declineLink, organizationName, inviterName, role } =
    params;

  const html = `<!DOCTYPE html><html><body><p>${inviterName} invited you to join ${organizationName} as ${role === "admin" ? "an" : "a"} ${role}.</p><p><a href="${inviteLink}">Accept</a> | <a href="${declineLink}">Decline</a></p></body></html>`;
  const text = `${inviterName} invited you to join ${organizationName} as ${role === "admin" ? "an" : "a"} ${role}.\n\nAccept: ${inviteLink}\nDecline: ${declineLink}`;

  return { html, text };
}
