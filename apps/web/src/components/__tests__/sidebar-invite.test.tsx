/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockUseSidebar = vi.fn(() => ({ state: "expanded" }));
vi.mock("@/components/ui/sidebar", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/components/ui/sidebar"
  );
  return { ...actual, useSidebar: () => mockUseSidebar() };
});

const mockUseActiveOrganization = vi.fn(() => ({
  activeOrganization: { slug: "test-org" },
}));
vi.mock("@/contexts/organization-context", () => ({
  useActiveOrganization: () => mockUseActiveOrganization(),
}));

const mockUseProductsStore = vi.fn();
vi.mock("@/stores/products-store", () => ({
  useProductsStore: (selector: (s: unknown) => unknown) =>
    selector({ status: mockUseProductsStore() }),
}));

import { SidebarInvite } from "../sidebar-invite";

afterEach(cleanup);

describe("SidebarInvite", () => {
  it("renders invite CTA when memberCount is 1", () => {
    mockUseProductsStore.mockReturnValue({ memberCount: 1 });

    render(<SidebarInvite />);
    expect(screen.getByText("Invite your team")).toBeDefined();
    expect(
      screen.getByRole("link", { name: /invite your team/i })
    ).toBeDefined();
  });

  it("returns null when memberCount > 1", () => {
    mockUseProductsStore.mockReturnValue({ memberCount: 2 });

    const { container } = render(<SidebarInvite />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when sidebar is collapsed", () => {
    mockUseSidebar.mockReturnValue({ state: "collapsed" });
    mockUseProductsStore.mockReturnValue({ memberCount: 1 });

    const { container } = render(<SidebarInvite />);
    expect(container.innerHTML).toBe("");

    // Reset
    mockUseSidebar.mockReturnValue({ state: "expanded" });
  });

  it("returns null when no status available", () => {
    mockUseProductsStore.mockReturnValue(null);

    const { container } = render(<SidebarInvite />);
    expect(container.innerHTML).toBe("");
  });

  it("links to the members settings page", () => {
    mockUseProductsStore.mockReturnValue({ memberCount: 1 });

    render(<SidebarInvite />);
    const link = screen.getByRole("link", { name: /invite your team/i });
    expect(link.getAttribute("href")).toBe("/test-org/settings/members");
  });
});
