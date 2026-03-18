// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findEdgeAtPoint } from "../utils/find-edge-at-point";

describe("findEdgeAtPoint", () => {
  beforeEach(() => {
    // jsdom doesn't implement elementsFromPoint, so we stub it
    document.elementsFromPoint = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return edge ID when interaction element exists at point", () => {
    const interactionEl = document.createElement("path");
    interactionEl.classList.add("react-flow__edge-interaction");

    const edgeGroup = document.createElement("g");
    edgeGroup.classList.add("react-flow__edge");
    edgeGroup.setAttribute("data-id", "edge-123");
    edgeGroup.appendChild(interactionEl);
    document.body.appendChild(edgeGroup);

    vi.mocked(document.elementsFromPoint).mockReturnValue([
      interactionEl,
      edgeGroup,
    ]);

    expect(findEdgeAtPoint(100, 200)).toBe("edge-123");

    document.body.removeChild(edgeGroup);
  });

  it("should return null when no edge element at point", () => {
    vi.mocked(document.elementsFromPoint).mockReturnValue([]);
    expect(findEdgeAtPoint(100, 100)).toBeNull();
  });

  it("should return null when element has no data-id", () => {
    const interactionEl = document.createElement("path");
    interactionEl.classList.add("react-flow__edge-interaction");

    // Edge group without data-id
    const edgeGroup = document.createElement("g");
    edgeGroup.classList.add("react-flow__edge");
    edgeGroup.appendChild(interactionEl);
    document.body.appendChild(edgeGroup);

    vi.mocked(document.elementsFromPoint).mockReturnValue([
      interactionEl,
      edgeGroup,
    ]);

    expect(findEdgeAtPoint(100, 100)).toBeNull();

    document.body.removeChild(edgeGroup);
  });
});
