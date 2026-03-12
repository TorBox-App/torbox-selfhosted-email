import {
  type RenderInvitationEmailParams,
  renderInvitationEmail,
} from "@wraps/email/emails/invitation";
import { describe, expect, it } from "vitest";

const baseParams: RenderInvitationEmailParams = {
  inviteLink: "https://app.wraps.dev/invitations/123/accept",
  declineLink: "https://app.wraps.dev/invitations/123/decline",
  organizationName: "Acme Corp",
  inviterName: "Jane Doe",
  role: "admin",
};

describe("renderInvitationEmail", () => {
  it("returns HTML with inviter name, org name, and CTA buttons", () => {
    const { html, text } = renderInvitationEmail(baseParams);

    expect(html).toContain("Jane Doe");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("https://app.wraps.dev/invitations/123/accept");
    expect(html).toContain("https://app.wraps.dev/invitations/123/decline");
    expect(html).toContain("Accept Invitation");

    expect(text).toContain("Jane Doe");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("https://app.wraps.dev/invitations/123/accept");
  });

  it("includes workspace context section when provided", () => {
    const { html, text } = renderInvitationEmail({
      ...baseParams,
      workspaceContext: {
        templateCount: 3,
        contactCount: 150,
        hasAwsAccount: true,
        verifiedDomains: ["acme.com", "mail.acme.com"],
        hasSentEmail: true,
      },
    });

    expect(html).toContain("3 email templates");
    expect(html).toContain("150 contacts");
    expect(html).toContain("acme.com");
    expect(html).toContain("AWS connected");
    expect(text).toContain("3 email templates");
  });

  it("omits workspace context section when not provided", () => {
    const { html } = renderInvitationEmail(baseParams);

    expect(html).not.toContain("set up so far");
    expect(html).not.toContain("email templates");
    expect(html).not.toContain("AWS connected");
  });

  it("shows AWS not connected message when hasAwsAccount is false", () => {
    const { html } = renderInvitationEmail({
      ...baseParams,
      workspaceContext: {
        templateCount: 0,
        contactCount: 0,
        hasAwsAccount: false,
        verifiedDomains: [],
        hasSentEmail: false,
      },
    });

    expect(html).toContain("AWS infrastructure hasn't been connected yet");
  });
});
