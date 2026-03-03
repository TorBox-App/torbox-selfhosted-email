// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { BatchStats } from "../batch-stats";

afterEach(cleanup);

describe("BatchStats", () => {
  const completedBatch = {
    id: "batch-1",
    status: "completed",
    channel: "email" as const,
    totalRecipients: 12_500,
    processedRecipients: 12_500,
    sent: 12_450,
    delivered: 12_380,
    opened: 4952,
    clicked: 1238,
    bounced: 20,
    complained: 2,
    failed: 50,
    hardBounced: 12,
    softBounced: 8,
    startedAt: new Date("2026-02-22T08:36:50Z"),
    completedAt: new Date("2026-02-22T09:06:50Z"),
  };

  it("renders the status badge", () => {
    render(<BatchStats batch={completedBatch} organizationId="org-1" />);
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("renders the sankey chart with node labels", () => {
    render(<BatchStats batch={completedBatch} organizationId="org-1" />);
    expect(screen.getByText("Sent")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(screen.getByText("Opened")).toBeTruthy();
    expect(screen.getByText("Clicked")).toBeTruthy();
  });

  it("renders sankey chart counts", () => {
    render(<BatchStats batch={completedBatch} organizationId="org-1" />);
    expect(screen.getByText("12,450")).toBeTruthy();
    expect(screen.getByText("12,380")).toBeTruthy();
    expect(screen.getByText("4,952")).toBeTruthy();
    expect(screen.getByText("1,238")).toBeTruthy();
  });

  it("renders an SVG for the sankey diagram", () => {
    const { container } = render(
      <BatchStats batch={completedBatch} organizationId="org-1" />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    // Should have rect elements for sankey nodes
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });

  it("renders refresh button", () => {
    render(<BatchStats batch={completedBatch} organizationId="org-1" />);
    expect(screen.getByRole("button", { name: /refresh/i })).toBeTruthy();
  });

  it("renders duration", () => {
    render(<BatchStats batch={completedBatch} organizationId="org-1" />);
    expect(screen.getByText(/30m/)).toBeTruthy();
  });
});
