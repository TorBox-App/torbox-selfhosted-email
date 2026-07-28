/**
 * SES stored templates for the platform's own transactional auth email.
 *
 * These are the templates `sendTemplate()` names by string from
 * `src/emails/*.ts`. On the SaaS platform they were created by hand once; a
 * self-hosted install has no such history, so every signup died on
 * `Template email-verification does not exist` — the send path is fully wired
 * and still cannot deliver. `scripts/selfhost/templates.ts` publishes these on
 * deploy and upgrade.
 *
 * The variable names below are a contract with the senders, not decoration:
 * SES substitutes exactly the keys passed as `templateData`, and an unmatched
 * key renders as empty rather than failing. Change one side and you get a
 * silently blank email. Each sender is named above its template.
 *
 * Lives in @wraps/core rather than next to the senders in @wraps/email because
 * both self-hosted deploy paths have to publish it: `packages/cli` (the Pulumi
 * variant) already depends on core and cannot take a dependency on the email
 * package, whose entry pulls in the React Email renderer.
 */

export type AuthSesTemplate = {
  templateName: string;
  subject: string;
  htmlPart: string;
  textPart: string;
  /**
   * Representative values for TestRenderEmailTemplate at publish time. SES's
   * Handlebars dialect is not handlebars.js, so a template that renders
   * locally can still hard-fail in SES — this data is what proves it renders
   * there before a real signup depends on it. Booleans drive `{{#if}}`
   * branches, so the samples exercise the true case.
   */
  sampleData: Record<string, string>;
};

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Shared chrome, matching generateTopicConfirmationEmail: black masthead,
 * bordered white card, 600px column. Kept as a function rather than three
 * copies so the auth mail stays visually consistent as it changes.
 */
function layout(options: {
  heading: string;
  body: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.heading}</title>
  </head>
  <body style="font-family: ${FONT_STACK}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #000000; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">${options.heading}</h1>
    </div>

    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
${options.body}
    </div>

    <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
      <p>${options.footer}</p>
    </div>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `      <div style="text-align: center; margin: 40px 0;">
        <a href="${href}" style="display: inline-block; background: #000000; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          ${label}
        </a>
      </div>`;
}

function fallbackLink(href: string): string {
  return `      <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="font-size: 14px; color: #333333; word-break: break-all; background: #f9fafb; padding: 12px; border-radius: 6px;">
        ${href}
      </p>`;
}

/** Sender: src/emails/verification.ts — better-auth sendVerificationEmail. */
const EMAIL_VERIFICATION: AuthSesTemplate = {
  templateName: "email-verification",
  subject: "Verify your email address",
  // `name` is sent as "" when better-auth has no display name, so the greeting
  // has to branch — "Hi ," is the alternative.
  htmlPart: layout({
    heading: "Verify Your Email",
    body: `      <p style="font-size: 16px; margin-bottom: 20px;">{{#if name}}Hi {{name}},{{else}}Hi there,{{/if}}</p>

      <p style="font-size: 16px; margin-bottom: 20px;">
        Confirm this address to finish setting up your Wraps account.
      </p>

${button("{{verificationUrl}}", "Verify Email Address")}

${fallbackLink("{{verificationUrl}}")}

      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-top: 30px; border-left: 4px solid #000000;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          <strong>Note:</strong> If you didn't create a Wraps account, you can safely ignore this email.
        </p>
      </div>`,
    footer: "This email was sent by Wraps.",
  }),
  textPart: `Verify Your Email

{{#if name}}Hi {{name}},{{else}}Hi there,{{/if}}

Confirm this address to finish setting up your Wraps account:
{{verificationUrl}}

If you didn't create a Wraps account, you can safely ignore this email.

---
This email was sent by Wraps.`,
  sampleData: {
    name: "Ada",
    verificationUrl: "https://example.com/verify?t=x",
  },
};

/** Sender: src/emails/mobile-rescue.ts — signup completed on a phone. */
const MOBILE_RESCUE: AuthSesTemplate = {
  templateName: "mobile-rescue",
  subject: "Pick up where you left off in Wraps",
  htmlPart: layout({
    heading: "Continue on Desktop",
    body: `      <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>

      <p style="font-size: 16px; margin-bottom: 20px;">
        You started setting up <strong>{{orgName}}</strong> on your phone. Deploying
        infrastructure needs a terminal and your AWS credentials, so the rest of
        setup is easier on a desktop.
      </p>

      <p style="font-size: 16px; margin-bottom: 20px;">
        This link opens your dashboard wherever you're signed in:
      </p>

${button("{{dashboardUrl}}", "Open Dashboard")}

${fallbackLink("{{dashboardUrl}}")}`,
    footer: "This email was sent by Wraps.",
  }),
  textPart: `Continue on Desktop

Hi there,

You started setting up {{orgName}} on your phone. Deploying infrastructure needs
a terminal and your AWS credentials, so the rest of setup is easier on a desktop.

Open your dashboard:
{{dashboardUrl}}

---
This email was sent by Wraps.`,
  sampleData: {
    orgName: "Acme",
    dashboardUrl: "https://example.com/dashboard",
  },
};

/** Sender: src/emails/invitation.ts — organization member invite. */
const TEAM_INVITATION: AuthSesTemplate = {
  templateName: "team-invitation",
  subject: "{{inviterName}} invited you to join {{organizationName}} on Wraps",
  // workspaceItemsHtml arrives as pre-built <li> markup from
  // buildWorkspaceItemsHtml, so it is interpolated raw with a triple stash.
  // A double stash would escape the tags and print them as visible text.
  htmlPart: layout({
    heading: "You're Invited",
    body: `      <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>

      <p style="font-size: 16px; margin-bottom: 20px;">
        <strong>{{inviterName}}</strong> invited you to join
        <strong>{{organizationName}}</strong> as {{roleArticle}} {{role}}.
      </p>

      {{#if workspaceItemsHtml}}
      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;"><strong>What's already set up:</strong></p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #6b7280;">{{{workspaceItemsHtml}}}</ul>
      </div>
      {{/if}}

${button("{{inviteLink}}", "Accept Invitation")}

      {{#if showAwsWarning}}
      <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-top: 30px; border-left: 4px solid #f97316;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          <strong>Heads up:</strong> this workspace has no AWS account connected yet,
          so there's no sending infrastructure until someone runs <code>wraps email init</code>.
        </p>
      </div>
      {{/if}}

      <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
        Not expecting this? <a href="{{declineLink}}" style="color: #6b7280;">Decline the invitation</a>.
      </p>`,
    footer: "This email was sent by Wraps.",
  }),
  textPart: `You're Invited

Hi there,

{{inviterName}} invited you to join {{organizationName}} as {{roleArticle}} {{role}}.

Accept the invitation:
{{inviteLink}}

{{#if showAwsWarning}}Heads up: this workspace has no AWS account connected yet, so
there's no sending infrastructure until someone runs \`wraps email init\`.

{{/if}}Not expecting this? Decline here:
{{declineLink}}

---
This email was sent by Wraps.`,
  sampleData: {
    inviterName: "Ada",
    organizationName: "Acme",
    role: "admin",
    roleArticle: "an",
    inviteLink: "https://example.com/invite/x",
    declineLink: "https://example.com/invite/x/decline",
    workspaceItemsHtml: "<li>3 email templates</li>",
    showAwsWarning: "true",
  },
};

/**
 * Every template the platform's own auth email depends on. Order is stable so
 * deploy output reads the same way twice.
 */
export const AUTH_SES_TEMPLATES: readonly AuthSesTemplate[] = [
  EMAIL_VERIFICATION,
  MOBILE_RESCUE,
  TEAM_INVITATION,
];
