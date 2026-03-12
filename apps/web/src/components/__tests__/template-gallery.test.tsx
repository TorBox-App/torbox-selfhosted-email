/**
 * TemplateGallery Tests
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockCapture, mockMutateAsync } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockCapture: vi.fn(),
  mockMutateAsync: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("posthog-js", () => ({
  default: { capture: mockCapture },
}));

vi.mock("@/hooks/use-template-queries", () => ({
  useCreateTemplate: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// Mock compileTemplate
vi.mock("@/lib/compile-template", () => ({
  compileTemplate: vi.fn(async () => ({
    compiledHtml: "<html><h1>Compiled</h1></html>",
    compiledText: "Compiled",
    variables: [],
    subject: "Test Subject",
    emailType: "marketing",
    previewText: "Test Preview",
  })),
}));

import { TemplateGallery } from "../template-editor/template-gallery";

describe("TemplateGallery", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render all 6 starter template cards when email channel is selected", () => {
    render(<TemplateGallery orgSlug="test-org" />);

    expect(screen.getByText("Welcome Email")).toBeInTheDocument();
    expect(screen.getByText("Newsletter")).toBeInTheDocument();
    expect(screen.getByText("Promotional")).toBeInTheDocument();
    expect(screen.getByText("Password Reset")).toBeInTheDocument();
    expect(screen.getByText("Order Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Product Update")).toBeInTheDocument();
  });

  it("should show simple name form when SMS channel is selected", async () => {
    const user = userEvent.setup();
    render(<TemplateGallery orgSlug="test-org" />);

    // Click SMS channel toggle
    await user.click(screen.getByRole("button", { name: /sms/i }));

    // Should show a name input, not starter cards
    expect(screen.getByPlaceholderText(/sms/i)).toBeInTheDocument();
    // Starter cards should not be visible
    expect(screen.queryByText("Welcome Email")).not.toBeInTheDocument();
  });

  it("should create template with source when clicking a starter card", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ id: "new-template-123" });

    render(<TemplateGallery orgSlug="test-org" />);

    // Click the Welcome Email card
    await user.click(screen.getByText("Welcome Email"));

    // Should call createTemplate with source fields
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Welcome Email",
          source: expect.any(String),
          compiledHtml: "<html><h1>Compiled</h1></html>",
          subject: "Test Subject",
          emailType: "marketing",
          previewText: "Test Preview",
        })
      );
    });

    // Should redirect to template editor
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/test-org/emails/templates/new-template-123"
      );
    });
  });
});
