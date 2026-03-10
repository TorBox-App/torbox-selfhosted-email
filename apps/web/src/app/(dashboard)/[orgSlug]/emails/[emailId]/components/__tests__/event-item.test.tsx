// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventItem } from "../event-item";

afterEach(cleanup);

describe("EventItem bot detection", () => {
  it("shows Automated badge for open events with bot user agent", () => {
    render(
      <EventItem
        color="text-purple-500"
        event={{
          type: "open",
          timestamp: Date.now(),
          metadata: {
            userAgent: "Barracuda/5.0",
            ipAddress: "1.2.3.4",
          },
        }}
        iconType="open"
        isLast={false}
      />
    );

    expect(screen.getByText("Automated")).toBeTruthy();
  });

  it("does not show Automated badge for open events with real user agent", () => {
    render(
      <EventItem
        color="text-purple-500"
        event={{
          type: "open",
          timestamp: Date.now(),
          metadata: {
            userAgent:
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            ipAddress: "203.0.113.42",
          },
        }}
        iconType="open"
        isLast={false}
      />
    );

    expect(screen.queryByText("Automated")).toBeNull();
  });

  it("shows Automated badge for open events with no user agent", () => {
    render(
      <EventItem
        color="text-purple-500"
        event={{
          type: "open",
          timestamp: Date.now(),
          metadata: {
            ipAddress: "1.2.3.4",
          },
        }}
        iconType="open"
        isLast={false}
      />
    );

    expect(screen.getByText("Automated")).toBeTruthy();
  });

  it("does not show Automated badge for non-open events", () => {
    render(
      <EventItem
        color="text-green-500"
        event={{
          type: "delivery",
          timestamp: Date.now(),
          metadata: {
            recipients: ["user@example.com"],
          },
        }}
        iconType="delivery"
        isLast={false}
      />
    );

    expect(screen.queryByText("Automated")).toBeNull();
  });
});
