// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EmailListFeed } from "../../types";
import { EmailFeedBanners } from "../event-feed-banners";

afterEach(cleanup);

describe("EmailFeedBanners", () => {
  it("names the stale account in the banner title when the org has several accounts", () => {
    const feed: EmailListFeed = {
      hasEverSent: true,
      accounts: [
        {
          maskedAccountId: "0108...6701",
          eventFeedStaleSince: null,
          hasEverReceivedEvents: true,
          lastEventReceivedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        {
          maskedAccountId: "8184...6748",
          eventFeedStaleSince: new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ).toISOString(),
          hasEverReceivedEvents: true,
          lastEventReceivedAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ],
    };

    render(<EmailFeedBanners feed={feed} />);

    expect(
      screen.getByText(
        "Event streaming appears disconnected for AWS account 8184...6748"
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("AWS account 8184...6748")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/0108\.\.\.6701/)).not.toBeInTheDocument();
  });

  it("keeps the plain title for a single-account org", () => {
    const feed: EmailListFeed = {
      hasEverSent: true,
      accounts: [
        {
          maskedAccountId: "8184...6748",
          eventFeedStaleSince: new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ).toISOString(),
          hasEverReceivedEvents: true,
          lastEventReceivedAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ],
    };

    render(<EmailFeedBanners feed={feed} />);

    expect(
      screen.getByText("Event streaming appears disconnected")
    ).toBeInTheDocument();
  });

  it("renders nothing when every account is healthy", () => {
    const feed: EmailListFeed = {
      hasEverSent: true,
      accounts: [
        {
          maskedAccountId: "0108...6701",
          eventFeedStaleSince: null,
          hasEverReceivedEvents: true,
          lastEventReceivedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        {
          maskedAccountId: "8184...6748",
          eventFeedStaleSince: null,
          hasEverReceivedEvents: true,
          lastEventReceivedAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    };

    const { container } = render(<EmailFeedBanners feed={feed} />);

    expect(container.innerHTML).toBe("");
  });
});
