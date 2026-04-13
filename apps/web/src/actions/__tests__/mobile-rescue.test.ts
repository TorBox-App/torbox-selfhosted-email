import { afterEach, describe, expect, it, vi } from "vitest";

// Mock getWrapsClient (used by sendMobileRescueEmail)
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

// Mock verifyOrgAccess
const mockVerifyOrgAccess = vi.fn();
vi.mock("../shared/verify-org-access", () => ({
  verifyOrgAccess: (...args: unknown[]) => mockVerifyOrgAccess(...args),
}));

// Mock next/headers (required by verifyOrgAccess)
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

// Mock PostHog server
const mockCapture = vi.fn();
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: mockCapture }),
}));

import { sendMobileRescueEmail } from "@wraps/email/emails/mobile-rescue";
import { sendDesktopLink } from "../mobile-rescue";

describe("sendMobileRescueEmail", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends template with correct name and data", async () => {
    await sendMobileRescueEmail({
      to: "user@example.com",
      dashboardUrl: "https://app.wraps.dev/my-org/onboarding",
      orgName: "my-org",
    });

    expect(mockSendTemplate).toHaveBeenCalledOnce();
    const call = mockSendTemplate.mock.calls[0]![0]!;

    expect(call.template).toBe("mobile-rescue");
    expect(call.to).toBe("user@example.com");
    expect(call.templateData).toEqual({
      orgName: "my-org",
      dashboardUrl: "https://app.wraps.dev/my-org/onboarding",
    });
  });
});

describe("sendDesktopLink", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when verifyOrgAccess returns null", async () => {
    mockVerifyOrgAccess.mockResolvedValue(null);

    const result = await sendDesktopLink("org-123");

    expect(result).toEqual({ success: false, error: "No access" });
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it("sends email and returns success on valid access", async () => {
    mockVerifyOrgAccess.mockResolvedValue({
      userId: "user-1",
      userEmail: "user@example.com",
      role: "owner",
      orgSlug: "my-org",
    });

    const result = await sendDesktopLink("org-123");

    expect(result).toEqual({ success: true });
    expect(mockSendTemplate).toHaveBeenCalledOnce();
    const call = mockSendTemplate.mock.calls[0]![0]!;
    expect(call.to).toBe("user@example.com");
    expect(call.templateData.orgName).toBe("my-org");
  });

  it("returns error when email sending throws", async () => {
    mockVerifyOrgAccess.mockResolvedValue({
      userId: "user-1",
      userEmail: "user@example.com",
      role: "owner",
      orgSlug: "my-org",
    });
    mockSendTemplate.mockRejectedValueOnce(
      new Error("SES role assumption failed")
    );

    const result = await sendDesktopLink("org-123");

    expect(result).toEqual({ success: false, error: "Failed to send email" });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("captures PostHog event with correct properties", async () => {
    mockVerifyOrgAccess.mockResolvedValue({
      userId: "user-1",
      userEmail: "user@example.com",
      role: "owner",
      orgSlug: "my-org",
    });

    await sendDesktopLink("org-123");

    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "mobile_signup_rescue_sent",
      properties: {
        organization_id: "org-123",
        org_slug: "my-org",
      },
    });
  });
});
