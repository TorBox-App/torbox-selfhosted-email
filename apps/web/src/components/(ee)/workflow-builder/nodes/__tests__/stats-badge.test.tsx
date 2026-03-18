// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkflowNodeStepStats } from "@/actions/workflows";
import { StatsBadge } from "../stats-badge";

function makeStats(
  overrides: Partial<WorkflowNodeStepStats> = {}
): WorkflowNodeStepStats {
  return {
    stepId: "step-1",
    stepType: "send_email",
    totalCount: 0,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    ...overrides,
  };
}

describe("StatsBadge", () => {
  it("renders completed count", () => {
    render(<StatsBadge stats={makeStats({ completedCount: 150 })} />);
    expect(screen.getByText("150 processed")).toBeTruthy();
  });

  it("renders nothing meaningful when stats are zero", () => {
    const { container } = render(<StatsBadge stats={makeStats()} />);
    expect(screen.getByText("0 processed")).toBeTruthy();
    // Should not show engagement or branch badges
    expect(container.textContent).not.toContain("sent");
    expect(container.textContent).not.toContain("yes");
  });

  it("renders email engagement rates", () => {
    render(
      <StatsBadge
        stats={makeStats({
          sentCount: 100,
          openedCount: 45,
          clickedCount: 12,
          completedCount: 100,
        })}
      />
    );
    expect(screen.getByText("100 sent")).toBeTruthy();
    expect(screen.getByText("45% opened")).toBeTruthy();
    expect(screen.getByText("12% clicked")).toBeTruthy();
  });

  it("hides engagement when sentCount is 0", () => {
    const { container } = render(
      <StatsBadge
        stats={makeStats({
          sentCount: 0,
          openedCount: 0,
          completedCount: 5,
        })}
      />
    );
    expect(container.textContent).not.toContain("sent");
    expect(container.textContent).not.toContain("opened");
  });

  it("renders branch counts for condition nodes", () => {
    render(
      <StatsBadge
        stats={makeStats({
          stepType: "condition",
          yesBranchCount: 80,
          noBranchCount: 20,
          completedCount: 100,
        })}
      />
    );
    expect(screen.getByText("80 yes")).toBeTruthy();
    expect(screen.getByText("20 no")).toBeTruthy();
  });
});
