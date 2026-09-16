/**
 * EmailArchiveViewer - archived sent-mail iframe sandbox (plan 344)
 *
 * This renders the org's own archived sent mail, not third-party content, but
 * the iframe still carried `sandbox="allow-same-origin"` - a latent sandbox
 * escape the day someone adds `allow-scripts` to fix a rendering complaint.
 * Nothing here reads contentWindow, so the frame has no reason to hold the
 * app's origin. These tests pin the fully-sandboxed replacement and the
 * no-referrer policy that keeps remote images from leaking the dashboard URL.
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useArchivedEmailMock = vi.fn();
vi.mock("@/hooks/use-archived-email", () => ({
  useArchivedEmail: (...args: unknown[]) => useArchivedEmailMock(...args),
}));

import { EmailArchiveViewer } from "../email-archive-viewer";

function mockArchivedEmail(overrides: Record<string, unknown> = {}) {
  useArchivedEmailMock.mockReturnValue({
    data: {
      messageId: "0100018f-1111-2222-3333-444455556666",
      from: "billing@acme.test",
      to: "customer@example.com",
      subject: "Your invoice",
      html: "<p>Hello there</p>",
      text: "Hello there",
      attachments: [],
      headers: {},
      timestamp: new Date("2026-09-01T00:00:00.000Z"),
      ...overrides,
    },
    isLoading: false,
    error: null,
  });
}

describe("EmailArchiveViewer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the HTML preview iframe fully sandboxed with no referrer leak", () => {
    mockArchivedEmail();

    render(
      <EmailArchiveViewer
        archivingEnabled={true}
        messageId="0100018f-1111-2222-3333-444455556666"
        orgSlug="acme"
      />
    );

    const iframe = screen.getByTitle("Email preview");
    expect(iframe).toHaveAttribute("sandbox", "");
    expect(iframe).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("never grants the frame allow-same-origin", () => {
    mockArchivedEmail();

    render(
      <EmailArchiveViewer
        archivingEnabled={true}
        messageId="0100018f-1111-2222-3333-444455556666"
        orgSlug="acme"
      />
    );

    const iframe = screen.getByTitle("Email preview");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
  });

  it("shows 'No HTML content available' and no iframe when the archived email has no html", () => {
    mockArchivedEmail({ html: undefined });

    render(
      <EmailArchiveViewer
        archivingEnabled={true}
        messageId="0100018f-1111-2222-3333-444455556666"
        orgSlug="acme"
      />
    );

    expect(
      screen.getByText(/no html content available for this email/i)
    ).toBeInTheDocument();
    expect(screen.queryByTitle("Email preview")).not.toBeInTheDocument();
  });
});
