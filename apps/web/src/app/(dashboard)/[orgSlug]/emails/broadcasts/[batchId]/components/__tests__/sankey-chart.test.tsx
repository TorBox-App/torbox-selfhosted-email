// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SankeyChart } from "../sankey-chart";

describe("SankeyChart", () => {
  const defaultProps = {
    channel: "email" as const,
    sent: 12_450,
    delivered: 12_380,
    opened: 4952,
    clicked: 1238,
    failed: 50,
    bounced: 20,
    complained: 2,
    hardBounced: 12,
    softBounced: 8,
  };

  it("renders an SVG element", () => {
    const { container } = render(<SankeyChart {...defaultProps} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders node labels", () => {
    render(<SankeyChart {...defaultProps} />);
    expect(screen.getByText("Sent")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(screen.getByText("Opened")).toBeTruthy();
    expect(screen.getByText("Clicked")).toBeTruthy();
  });

  it("renders formatted counts next to labels", () => {
    render(<SankeyChart {...defaultProps} />);
    expect(screen.getByText("12,450")).toBeTruthy();
    expect(screen.getByText("12,380")).toBeTruthy();
    expect(screen.getByText("4,952")).toBeTruthy();
    expect(screen.getByText("1,238")).toBeTruthy();
  });

  it("renders link paths between nodes", () => {
    const { container } = render(<SankeyChart {...defaultProps} />);
    // d3-sankey generates <path> elements for links
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renders node rectangles", () => {
    const { container } = render(<SankeyChart {...defaultProps} />);
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });

  it("does not render Opened/Clicked for SMS", () => {
    render(
      <SankeyChart {...defaultProps} channel="sms" clicked={0} opened={0} />
    );
    expect(screen.queryByText("Opened")).toBeNull();
    expect(screen.queryByText("Clicked")).toBeNull();
    expect(screen.getByText("Sent")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
  });

  it("uses distinct fill colors for nodes", () => {
    const { container } = render(<SankeyChart {...defaultProps} />);
    const rects = container.querySelectorAll("rect");
    const fills = new Set<string>();
    for (const rect of rects) {
      const fill = rect.getAttribute("fill");
      if (fill) fills.add(fill);
    }
    // Should have more than 1 distinct color
    expect(fills.size).toBeGreaterThan(1);
  });
});
