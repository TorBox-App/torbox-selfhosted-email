import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the email client used by sendMobileRescueEmail
vi.mock("@wraps/email/lib/client", () => ({
  sendEmail: vi.fn(async () => ({ success: true, messageId: "test-msg-id" })),
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
import { sendEmail } from "@wraps/email/lib/client";
import { sendDesktopLink } from "../mobile-rescue";

describe("sendMobileRescueEmail", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends email with correct subject, HTML dashboard link, and plain text", async () => {
    await sendMobileRescueEmail({
      to: "user@example.com",
      dashboardUrl: "https://app.wraps.dev/my-org/onboarding",
      orgName: "my-org",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.subject).toBe("Continue setting up my-org on your computer");
    expect(call.html).toContain(
      'href="https://app.wraps.dev/my-org/onboarding"'
    );
    expect(call.html).toContain("my-org");
    expect(call.text).toContain("https://app.wraps.dev/my-org/onboarding");
    expect(call.to).toBe("user@example.com");
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
    expect(sendEmail).not.toHaveBeenCalled();
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
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toContain("my-org");
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
