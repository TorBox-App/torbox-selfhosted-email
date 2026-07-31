/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@wraps/ui/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

import { SegmentBuilder } from "../segment-builder";

const noop = () => {};

describe("SegmentBuilder value input type", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a number input when the operator is greaterThan on a custom property", () => {
    render(
      <SegmentBuilder
        condition={{
          logic: "AND",
          groups: [
            {
              id: "group-1",
              filters: [
                {
                  id: "filter-1",
                  field: "properties.monthly_spend",
                  operator: "greaterThan",
                  value: 100,
                },
              ],
            },
          ],
        }}
        onChange={noop}
        propertyKeys={["monthly_spend"]}
        topics={[]}
      />
    );

    const valueInput = screen.getByPlaceholderText("0");
    expect(valueInput).toHaveAttribute("type", "number");
    expect(valueInput).toHaveAttribute("step", "any");
  });

  it("renders a text input when the operator is equals on a custom property", () => {
    render(
      <SegmentBuilder
        condition={{
          logic: "AND",
          groups: [
            {
              id: "group-1",
              filters: [
                {
                  id: "filter-1",
                  field: "properties.plan",
                  operator: "equals",
                  value: "pro",
                },
              ],
            },
          ],
        }}
        onChange={noop}
        propertyKeys={["plan"]}
        topics={[]}
      />
    );

    const valueInput = screen.getByPlaceholderText("value");
    expect(valueInput.tagName).toBe("INPUT");
    expect(valueInput).not.toHaveAttribute("type", "number");
  });

  it("renders paired number/count inputs for a partition filter", () => {
    render(
      <SegmentBuilder
        condition={{
          logic: "AND",
          groups: [
            {
              id: "group-1",
              filters: [
                {
                  id: "filter-1",
                  field: "bucket",
                  operator: "inBucket",
                  value: { buckets: 6, index: 2 },
                },
              ],
            },
          ],
        }}
        onChange={noop}
        propertyKeys={[]}
        topics={[]}
      />
    );

    expect(screen.getByLabelText("Partition number")).toHaveValue(2);
    expect(screen.getByLabelText("Partition count")).toHaveValue(6);
  });

  it("renders a date input when an ordered comparison already holds a date", () => {
    const { container } = render(
      <SegmentBuilder
        condition={{
          logic: "AND",
          groups: [
            {
              id: "group-1",
              filters: [
                {
                  id: "filter-1",
                  field: "properties.createdAt",
                  operator: "greaterThanOrEqual",
                  value: "2026-07-01",
                },
              ],
            },
          ],
        }}
        onChange={noop}
        propertyKeys={["createdAt"]}
        topics={[]}
      />
    );

    expect(container.querySelector('input[type="date"]')).toHaveValue(
      "2026-07-01"
    );
    expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
  });
});
