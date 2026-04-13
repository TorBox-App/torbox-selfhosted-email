import { afterEach, describe, expect, it, vi } from "vitest";

// Mock getWrapsClient
type TemplateCall = {
  template: string;
  to: string;
  from: string;
  templateData: Record<string, unknown>;
};
const mockSendTemplate = vi.fn<
  (params: TemplateCall) => Promise<{ messageId: string }>
>(async () => ({ messageId: "test-msg-id" }));
vi.mock("@wraps/email/lib/client", () => ({
  getWrapsClient: vi.fn(async () => ({
    sendTemplate: mockSendTemplate,
  })),
}));

import { sendInvitationEmail } from "@wraps/email/emails/invitation";

describe("sendInvitationEmail", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends template with inviter name, org name, and links", async () => {
    await sendInvitationEmail({
      to: "user@example.com",
      inviteLink: "https://app.wraps.dev/invitations/123/accept",
      declineLink: "https://app.wraps.dev/invitations/123/decline",
      organizationName: "Acme Corp",
      inviterName: "Jane Doe",
      role: "admin",
    });

    expect(mockSendTemplate).toHaveBeenCalledOnce();
    const call = mockSendTemplate.mock.calls[0]![0]!;

    expect(call.template).toBe("team-invitation");
    expect(call.to).toBe("user@example.com");
    expect(call.templateData.inviterName).toBe("Jane Doe");
    expect(call.templateData.organizationName).toBe("Acme Corp");
    expect(call.templateData.role).toBe("admin");
    expect(call.templateData.roleArticle).toBe("an");
    expect(call.templateData.inviteLink).toBe(
      "https://app.wraps.dev/invitations/123/accept"
    );
    expect(call.templateData.declineLink).toBe(
      "https://app.wraps.dev/invitations/123/decline"
    );
  });

  it("uses 'a' article for member role", async () => {
    await sendInvitationEmail({
      to: "user@example.com",
      inviteLink: "https://app.wraps.dev/invitations/123/accept",
      declineLink: "https://app.wraps.dev/invitations/123/decline",
      organizationName: "Acme Corp",
      inviterName: "Jane Doe",
      role: "member",
    });

    const call = mockSendTemplate.mock.calls[0]![0]!;
    expect(call.templateData.roleArticle).toBe("a");
  });

  it("includes workspace context as HTML when provided", async () => {
    await sendInvitationEmail({
      to: "user@example.com",
      inviteLink: "https://app.wraps.dev/invitations/123/accept",
      declineLink: "https://app.wraps.dev/invitations/123/decline",
      organizationName: "Acme Corp",
      inviterName: "Jane Doe",
      role: "admin",
      workspaceContext: {
        templateCount: 3,
        contactCount: 150,
        hasAwsAccount: true,
        verifiedDomains: ["acme.com", "mail.acme.com"],
        hasSentEmail: true,
      },
    });

    const call = mockSendTemplate.mock.calls[0]![0]!;
    expect(call.templateData.workspaceItemsHtml).toContain("3 email templates");
    expect(call.templateData.workspaceItemsHtml).toContain("150 contacts");
    expect(call.templateData.workspaceItemsHtml).toContain("AWS connected");
    expect(call.templateData.workspaceItemsHtml).toContain("acme.com");
    expect(call.templateData.showAwsWarning).toBe(false);
  });

  it("sends empty workspace items when not provided", async () => {
    await sendInvitationEmail({
      to: "user@example.com",
      inviteLink: "https://app.wraps.dev/invitations/123/accept",
      declineLink: "https://app.wraps.dev/invitations/123/decline",
      organizationName: "Acme Corp",
      inviterName: "Jane Doe",
      role: "admin",
    });

    const call = mockSendTemplate.mock.calls[0]![0]!;
    expect(call.templateData.workspaceItemsHtml).toBe("");
  });

  it("shows AWS warning when account not connected", async () => {
    await sendInvitationEmail({
      to: "user@example.com",
      inviteLink: "https://app.wraps.dev/invitations/123/accept",
      declineLink: "https://app.wraps.dev/invitations/123/decline",
      organizationName: "Acme Corp",
      inviterName: "Jane Doe",
      role: "admin",
      workspaceContext: {
        templateCount: 0,
        contactCount: 0,
        hasAwsAccount: false,
        verifiedDomains: [],
        hasSentEmail: false,
      },
    });

    const call = mockSendTemplate.mock.calls[0]![0]!;
    expect(call.templateData.showAwsWarning).toBe(true);
  });
});
