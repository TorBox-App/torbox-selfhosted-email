// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventFeedStaleBanner } from "../event-feed-stale-banner";

afterEach(cleanup);

describe("EventFeedStaleBanner", () => {
  it("renders the warning when eventFeedStaleSince is set", () => {
    render(
      <EventFeedStaleBanner
        account={{ eventFeedStaleSince: new Date(Date.now() - 60_000) }}
      />
    );

    expect(
      screen.getByText("Event streaming appears disconnected")
    ).toBeInTheDocument();
    expect(screen.getByText(/wraps email doctor/)).toBeInTheDocument();
  });

  it("renders nothing when eventFeedStaleSince is null", () => {
    const { container } = render(
      <EventFeedStaleBanner account={{ eventFeedStaleSince: null }} />
    );

    expect(container.innerHTML).toBe("");
  });
});
