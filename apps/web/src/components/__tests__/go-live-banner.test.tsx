/**
 * GoLiveBanner Tests
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoLiveBanner } from "../go-live-banner";

vi.mock("@/stores/products-store", () => ({
  useProductsStore: vi.fn(),
}));

const mockSessionStorage = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => mockSessionStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
  removeItem: (key: string) => mockSessionStorage.delete(key),
  clear: () => mockSessionStorage.clear(),
});

import { useProductsStore } from "@/stores/products-store";

const mockUseProductsStore = vi.mocked(useProductsStore);

describe("GoLiveBanner", () => {
  beforeEach(() => {
    mockSessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders banner message when hasAwsAccounts is false", () => {
    mockUseProductsStore.mockImplementation((selector: any) =>
      selector({ status: { hasAwsAccounts: false } })
    );

    render(<GoLiveBanner orgSlug="test-org" />);

    expect(
      screen.getByText("Connect your AWS account to start sending emails.")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("returns null when hasAwsAccounts is true", () => {
    mockUseProductsStore.mockImplementation((selector: any) =>
      selector({ status: { hasAwsAccounts: true } })
    );

    const { container } = render(<GoLiveBanner orgSlug="test-org" />);

    expect(container.innerHTML).toBe("");
  });

  it("Get Started link points to /{orgSlug}/setup", () => {
    mockUseProductsStore.mockImplementation((selector: any) =>
      selector({ status: { hasAwsAccounts: false } })
    );

    render(<GoLiveBanner orgSlug="my-company" />);

    const link = screen.getByRole("link", { name: /get started/i });
    expect(link).toHaveAttribute("href", "/my-company/setup");
  });

  it("dismiss button hides banner and sets sessionStorage", async () => {
    const user = userEvent.setup();
    mockUseProductsStore.mockImplementation((selector: any) =>
      selector({ status: { hasAwsAccounts: false } })
    );

    render(<GoLiveBanner orgSlug="test-org" />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss banner/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mockSessionStorage.get("go-live-banner-dismissed-test-org")).toBe(
      "true"
    );
  });
});
