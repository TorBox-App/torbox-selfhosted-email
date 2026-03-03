// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FunnelChart } from "../funnel-chart";

afterEach(cleanup);

describe("FunnelChart", () => {
  const emailBatch = {
    channel: "email" as const,
    sent: 12_450,
    delivered: 12_380,
    opened: 4952,
    clicked: 1238,
    failed: 50,
    bounced: 20,
    complained: 2,
  };

  it("renders an SVG element", () => {
    const { container } = render(<FunnelChart {...emailBatch} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders stage labels for email (Sent, Delivered, Opened, Clicked)", () => {
    render(<FunnelChart {...emailBatch} />);
    expect(screen.getByText("Sent")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(screen.getByText("Opened")).toBeTruthy();
    expect(screen.getByText("Clicked")).toBeTruthy();
  });

  it("renders stage counts formatted with commas", () => {
    render(<FunnelChart {...emailBatch} />);
    expect(screen.getByText("12,450")).toBeTruthy();
    expect(screen.getByText("12,380")).toBeTruthy();
    expect(screen.getByText("4,952")).toBeTruthy();
    expect(screen.getByText("1,238")).toBeTruthy();
  });

  it("renders rates for non-Sent stages", () => {
    render(<FunnelChart {...emailBatch} />);
    expect(screen.getByText("99.4%")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
  });

  it("renders only Sent and Delivered for SMS channel", () => {
    render(
      <FunnelChart
        bounced={50}
        channel="sms"
        clicked={0}
        complained={0}
        delivered={4800}
        failed={100}
        opened={0}
        sent={5000}
      />
    );
    expect(screen.getByText("Sent")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(screen.queryByText("Opened")).toBeNull();
    expect(screen.queryByText("Clicked")).toBeNull();
  });

  it("renders issue indicators under relevant stages", () => {
    render(<FunnelChart {...emailBatch} />);
    expect(screen.getByText(/50 failed/)).toBeTruthy();
    expect(screen.getByText(/20 bounced/)).toBeTruthy();
    expect(screen.getByText(/2 complained/)).toBeTruthy();
  });

  it("omits issue indicators when counts are zero", () => {
    render(
      <FunnelChart
        bounced={0}
        channel="email"
        clicked={10}
        complained={0}
        delivered={100}
        failed={0}
        opened={50}
        sent={100}
      />
    );
    expect(screen.queryByText(/failed/)).toBeNull();
    expect(screen.queryByText(/bounced/)).toBeNull();
    expect(screen.queryByText(/complained/)).toBeNull();
  });
});
