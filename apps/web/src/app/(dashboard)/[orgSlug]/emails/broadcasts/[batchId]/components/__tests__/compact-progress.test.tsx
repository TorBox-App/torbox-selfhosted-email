// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { CompactProgress } from "../compact-progress";

afterEach(cleanup);

describe("CompactProgress", () => {
  it("renders status badge with correct label", () => {
    render(
      <CompactProgress
        completedAt={new Date("2026-02-22T09:06:50Z")}
        processedRecipients={12_500}
        startedAt={new Date("2026-02-22T08:36:50Z")}
        status="completed"
        totalRecipients={12_500}
      />
    );
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("shows progress bar and count when processing", () => {
    render(
      <CompactProgress
        completedAt={null}
        processedRecipients={6250}
        startedAt={new Date("2026-02-22T08:36:50Z")}
        status="processing"
        totalRecipients={12_500}
      />
    );
    expect(screen.getByText(/6,250/)).toBeTruthy();
    expect(screen.getByText(/12,500/)).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("shows Sending status with spinner when processing", () => {
    render(
      <CompactProgress
        completedAt={null}
        processedRecipients={6250}
        startedAt={new Date("2026-02-22T08:36:50Z")}
        status="processing"
        totalRecipients={12_500}
      />
    );
    expect(screen.getByText("Sending")).toBeTruthy();
  });

  it("hides progress bar when completed", () => {
    const { container } = render(
      <CompactProgress
        completedAt={new Date("2026-02-22T09:06:50Z")}
        processedRecipients={12_500}
        startedAt={new Date("2026-02-22T08:36:50Z")}
        status="completed"
        totalRecipients={12_500}
      />
    );
    // Progress bar uses data-slot="progress"
    expect(container.querySelector("[data-slot='progress']")).toBeNull();
  });

  it("shows duration for completed batches", () => {
    render(
      <CompactProgress
        completedAt={new Date("2026-02-22T09:06:50Z")}
        processedRecipients={12_500}
        startedAt={new Date("2026-02-22T08:36:50Z")}
        status="completed"
        totalRecipients={12_500}
      />
    );
    expect(screen.getByText(/30m/)).toBeTruthy();
  });

  it("shows refresh button", () => {
    render(
      <CompactProgress
        completedAt={new Date("2026-02-22T09:06:50Z")}
        processedRecipients={12_500}
        startedAt={new Date("2026-02-22T08:36:50Z")}
        status="completed"
        totalRecipients={12_500}
      />
    );
    expect(screen.getByRole("button", { name: /refresh/i })).toBeTruthy();
  });
});
