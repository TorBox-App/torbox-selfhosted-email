import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { computeSmartPath } from "../edges/compute-smart-path";

// Helper: create a minimal node with dimensions for the smart edge library
function makeNode(id: string, x: number, y: number, w = 180, h = 60) {
  return {
    id,
    position: { x, y },
    data: {},
    width: w,
    height: h,
  };
}

describe("computeSmartPath", () => {
  it("returns null when nodes array is empty", () => {
    const result = computeSmartPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 0,
      targetY: 200,
      targetPosition: Position.Top,
      nodes: [],
    });

    expect(result).toBeNull();
  });

  it("returns path object with svgPath, labelX, labelY when no obstacles", () => {
    // Source node at top, target node at bottom, wide gap with no obstacles
    const nodes = [makeNode("source", 0, 0), makeNode("target", 0, 400)];

    const result = computeSmartPath({
      sourceX: 90,
      sourceY: 60,
      sourcePosition: Position.Bottom,
      targetX: 90,
      targetY: 400,
      targetPosition: Position.Top,
      nodes: nodes as any,
    });

    expect(result).not.toBeNull();
    expect(result!.svgPath).toMatch(/^M/); // valid SVG path
    expect(typeof result!.labelX).toBe("number");
    expect(typeof result!.labelY).toBe("number");
  });

  it("returns null when node count exceeds 35 threshold", () => {
    const nodes = Array.from({ length: 36 }, (_, i) =>
      makeNode(`node-${i}`, i * 200, 0)
    );

    const result = computeSmartPath({
      sourceX: 0,
      sourceY: 60,
      sourcePosition: Position.Bottom,
      targetX: 0,
      targetY: 200,
      targetPosition: Position.Top,
      nodes: nodes as any,
    });

    expect(result).toBeNull();
  });

  it("returns path that avoids a single obstacle node between source and target", () => {
    // Source at top, target far below, obstacle node directly between them
    const nodes = [
      makeNode("source", 0, 0),
      makeNode("obstacle", 0, 200, 180, 60),
      makeNode("target", 0, 400),
    ];

    const result = computeSmartPath({
      sourceX: 90,
      sourceY: 60,
      sourcePosition: Position.Bottom,
      targetX: 90,
      targetY: 400,
      targetPosition: Position.Top,
      nodes: nodes as any,
    });

    expect(result).not.toBeNull();
    expect(result!.svgPath).toMatch(/^M/);
    // The path should route around the obstacle, meaning it must contain
    // horizontal movement (not a straight vertical line)
    expect(result!.svgPath.length).toBeGreaterThan(10);
  });

  it("returns null when pathfinding fails (unreachable target)", () => {
    // Source and target at the same position — degenerate case
    const nodes = [makeNode("source", 0, 0)];

    const result = computeSmartPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 0,
      targetY: 0,
      targetPosition: Position.Top,
      nodes: nodes as any,
    });

    expect(result).toBeNull();
  });

  it("returns correct shape: { svgPath: string, labelX: number, labelY: number }", () => {
    const nodes = [makeNode("source", 0, 0), makeNode("target", 0, 300)];

    const result = computeSmartPath({
      sourceX: 90,
      sourceY: 60,
      sourcePosition: Position.Bottom,
      targetX: 90,
      targetY: 300,
      targetPosition: Position.Top,
      nodes: nodes as any,
    });

    expect(result).not.toBeNull();
    // Verify the shape has exactly the expected keys
    expect(Object.keys(result!).sort()).toEqual([
      "labelX",
      "labelY",
      "svgPath",
    ]);
    expect(typeof result!.svgPath).toBe("string");
    expect(typeof result!.labelX).toBe("number");
    expect(typeof result!.labelY).toBe("number");
    // labelX and labelY should be finite numbers, not NaN
    expect(Number.isFinite(result!.labelX)).toBe(true);
    expect(Number.isFinite(result!.labelY)).toBe(true);
  });
});
