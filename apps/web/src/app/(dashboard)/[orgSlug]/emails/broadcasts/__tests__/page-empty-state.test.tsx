/**
 * Broadcasts Page — Empty State CTA
 *
 * Regression test for the dead-end "Create your first template" CTA on
 * /[orgSlug]/emails/broadcasts when an org has zero broadcasts. The CTA
 * should drive users to CREATE A BROADCAST (not a template) — real users
 * (e.g. TorBox) have 16 published templates and still cannot figure out
 * how to create a broadcast because the empty state sends them the wrong
 * direction.
 *
 * This test is expected to FAIL against the current implementation
 * (href points at /emails/templates/new) and PASS once the CTA is fixed
 * to point at /emails/broadcasts/new with broadcast-focused copy.
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORG_SLUG = "torbox";
const ORG_ID = "org-torbox-1";
const USER_ID = "user-1";

// Mock system boundaries only: next/headers, auth, org lookup, and the
// batch list action. Internal rendering (Empty, Button, Link) is real.
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect called with ${path}`);
  }),
}));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: USER_ID, email: "dev@torbox.app", name: "Dev" },
        session: {
          id: "sess-1",
          userId: USER_ID,
          token: "t",
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      })),
    },
  },
}));

vi.mock("@/lib/organization", () => ({
  getOrganizationWithMembership: vi.fn(async () => ({
    id: ORG_ID,
    slug: ORG_SLUG,
    name: "TorBox",
    userRole: "owner" as const,
  })),
}));

vi.mock("@/actions/batch", () => ({
  listBatchSends: vi.fn(async () => ({
    success: true,
    batches: [],
    total: 0,
    page: 1,
    pageSize: 20,
  })),
}));

import SendPage from "../page";

afterEach(cleanup);

describe("Broadcasts page — empty state CTA", () => {
  async function renderEmptyState() {
    const element = await SendPage({
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
      searchParams: Promise.resolve({}),
    });
    return render(element as React.ReactElement);
  }

  it("routes the primary CTA to the new-broadcast page, not the new-template page", async () => {
    await renderEmptyState();

    // Find every link inside the empty state and locate the primary CTA.
    // We look at it structurally (the first link rendered by the Empty
    // block) rather than by copy so the test doesn't have to change if
    // the label tweaks from "Create a broadcast" to "New broadcast" etc.
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);

    const primaryCta = links[0] as HTMLAnchorElement;
    const href = primaryCta.getAttribute("href") ?? "";

    expect(href).toContain(`/${ORG_SLUG}/emails/broadcasts/new`);
    expect(href).not.toContain("/emails/templates/new");
  });

  it("uses broadcast-focused copy for the primary CTA, not template copy", async () => {
    await renderEmptyState();

    // The CTA should talk about broadcasts, not templates. Users who
    // already have templates read "Create your first template" and bounce.
    expect(
      screen.queryByRole("link", { name: /template/i })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /broadcast/i })
    ).toBeInTheDocument();
  });
});
