import { describe, expect, it } from "vitest";
import { getLayoutedNodes } from "../layout/auto-layout";
import type { WorkflowEdge, WorkflowNode } from "../use-workflow-store";

// Helper: create a minimal node
function makeNode(
  id: string,
  type: string,
  position = { x: 0, y: 0 }
): WorkflowNode {
  return {
    id,
    type,
    position,
    data: {
      stepId: id,
      type: type as WorkflowNode["data"]["type"],
      name: id,
      config: { type: "exit" } as WorkflowNode["data"]["config"],
      isValid: true,
    },
  };
}

// Helper: create a minimal edge
function makeEdge(source: string, target: string): WorkflowEdge {
  return { id: `${source}-${target}`, source, target };
}

describe("getLayoutedNodes", () => {
  // --- Guard: insufficient nodes ---

  it("should return nodes unchanged when fewer than 2 nodes", () => {
    const nodes = [makeNode("a", "trigger")];
    const result = getLayoutedNodes(nodes, []);
    expect(result).toBe(nodes); // same reference
  });

  it("should return empty array unchanged", () => {
    const result = getLayoutedNodes([], []);
    expect(result).toEqual([]);
  });

  // --- Linear chain ---

  it("should layout a linear chain top-to-bottom", () => {
    const nodes = [
      makeNode("trigger", "trigger", { x: 500, y: 500 }),
      makeNode("email", "send_email", { x: 500, y: 500 }),
      makeNode("exit", "exit", { x: 500, y: 500 }),
    ];
    const edges = [makeEdge("trigger", "email"), makeEdge("email", "exit")];

    const result = getLayoutedNodes(nodes, edges);

    // All three nodes should be at the same X (centered)
    const xs = result.map((n) => n.position.x);
    expect(xs[0]).toBe(xs[1]);
    expect(xs[1]).toBe(xs[2]);

    // Y should increase: trigger < email < exit
    expect(result[0].position.y).toBeLessThan(result[1].position.y);
    expect(result[1].position.y).toBeLessThan(result[2].position.y);
  });

  // --- Branching (condition) ---

  it("should layout condition branches side by side", () => {
    const nodes = [
      makeNode("trigger", "trigger"),
      makeNode("cond", "condition"),
      makeNode("yes-email", "send_email"),
      makeNode("no-exit", "exit"),
    ];
    const edges = [
      makeEdge("trigger", "cond"),
      makeEdge("cond", "yes-email"),
      makeEdge("cond", "no-exit"),
    ];

    const result = getLayoutedNodes(nodes, edges);

    // Yes and No branches should be at different X positions
    const yesNode = result.find((n) => n.id === "yes-email")!;
    const noNode = result.find((n) => n.id === "no-exit")!;
    expect(yesNode.position.x).not.toBe(noNode.position.x);

    // Both should be below the condition node
    const condNode = result.find((n) => n.id === "cond")!;
    expect(yesNode.position.y).toBeGreaterThan(condNode.position.y);
    expect(noNode.position.y).toBeGreaterThan(condNode.position.y);
  });

  // --- Diamond (reconvergent) ---

  it("should handle diamond merge (DAG, not tree)", () => {
    const nodes = [
      makeNode("trigger", "trigger"),
      makeNode("cond", "condition"),
      makeNode("yes-email", "send_email"),
      makeNode("no-sms", "send_sms"),
      makeNode("merge-exit", "exit"),
    ];
    const edges = [
      makeEdge("trigger", "cond"),
      makeEdge("cond", "yes-email"),
      makeEdge("cond", "no-sms"),
      makeEdge("yes-email", "merge-exit"),
      makeEdge("no-sms", "merge-exit"),
    ];

    const result = getLayoutedNodes(nodes, edges);

    // Should not throw (d3-hierarchy would fail here)
    expect(result).toHaveLength(5);

    // Merge node should be below both branches
    const mergeNode = result.find((n) => n.id === "merge-exit")!;
    const yesNode = result.find((n) => n.id === "yes-email")!;
    const noNode = result.find((n) => n.id === "no-sms")!;
    expect(mergeNode.position.y).toBeGreaterThan(yesNode.position.y);
    expect(mergeNode.position.y).toBeGreaterThan(noNode.position.y);
  });

  // --- Coordinate transformation ---

  it("should produce top-left coordinates (not center)", () => {
    const nodes = [makeNode("a", "trigger"), makeNode("b", "send_email")];
    const edges = [makeEdge("a", "b")];

    const result = getLayoutedNodes(nodes, edges);

    // With default margins, positions should be non-negative
    for (const node of result) {
      expect(node.position.x).toBeGreaterThanOrEqual(-200);
      expect(node.position.y).toBeGreaterThanOrEqual(-200);
    }
  });

  // --- Cascade node dimensions ---

  it("should use dynamic height for cascade nodes", () => {
    const cascadeNode = makeNode("cascade-1", "cascade");
    cascadeNode.data.cascadeChannels = [
      { type: "email", engagement: "opened", waitDuration: 259_200 },
      { type: "sms" },
      { type: "email", engagement: "opened" },
    ];

    const nodes = [makeNode("trigger", "trigger"), cascadeNode];
    const edges = [makeEdge("trigger", "cascade-1")];

    const result = getLayoutedNodes(nodes, edges);

    // Should not throw; cascade node should be positioned
    const laid = result.find((n) => n.id === "cascade-1")!;
    expect(laid.position.x).toBeDefined();
    expect(laid.position.y).toBeDefined();
  });

  // --- Node data preservation ---

  it("should preserve all node data except position", () => {
    const nodes = [makeNode("a", "trigger"), makeNode("b", "send_email")];
    nodes[0].data.name = "My Trigger";
    nodes[0].data.config = {
      type: "trigger",
      triggerType: "event",
      eventName: "signup",
    } as WorkflowNode["data"]["config"];
    const edges = [makeEdge("a", "b")];

    const result = getLayoutedNodes(nodes, edges);
    const triggerNode = result.find((n) => n.id === "a")!;

    expect(triggerNode.id).toBe("a");
    expect(triggerNode.type).toBe("trigger");
    expect(triggerNode.data.name).toBe("My Trigger");
    expect(triggerNode.data.config).toEqual({
      type: "trigger",
      triggerType: "event",
      eventName: "signup",
    });
  });

  // --- Disconnected nodes ---

  it("should position disconnected nodes without crashing", () => {
    const nodes = [
      makeNode("a", "trigger"),
      makeNode("b", "send_email"),
      makeNode("orphan", "exit"), // no edges
    ];
    const edges = [makeEdge("a", "b")];

    const result = getLayoutedNodes(nodes, edges);

    // Should not throw, all nodes should have positions
    expect(result).toHaveLength(3);
    for (const node of result) {
      expect(node.position.x).toBeDefined();
      expect(node.position.y).toBeDefined();
    }
  });

  // --- Custom spacing options ---

  it("should respect custom nodesep and ranksep", () => {
    const nodes = [makeNode("a", "trigger"), makeNode("b", "send_email")];
    const edges = [makeEdge("a", "b")];

    const tight = getLayoutedNodes(nodes, edges, {
      nodesep: 20,
      ranksep: 40,
    });
    const wide = getLayoutedNodes(nodes, edges, {
      nodesep: 200,
      ranksep: 200,
    });

    // With wider spacing, the vertical gap should be larger
    const tightGap = tight[1].position.y - tight[0].position.y;
    const wideGap = wide[1].position.y - wide[0].position.y;
    expect(wideGap).toBeGreaterThan(tightGap);
  });

  // --- Condition node uses larger dimensions ---

  it("should account for condition node diamond size (130x130)", () => {
    const nodes = [
      makeNode("trigger", "trigger"),
      makeNode("cond", "condition"),
      makeNode("exit", "exit"),
    ];
    const edges = [makeEdge("trigger", "cond"), makeEdge("cond", "exit")];

    const result = getLayoutedNodes(nodes, edges);

    // Condition node should have more vertical space around it than standard nodes
    const triggerY = result.find((n) => n.id === "trigger")!.position.y;
    const condY = result.find((n) => n.id === "cond")!.position.y;
    const exitY = result.find((n) => n.id === "exit")!.position.y;

    // Gap from trigger to condition should be >= 100 (ranksep) because condition is 130px tall
    expect(condY - triggerY).toBeGreaterThanOrEqual(100);
    expect(exitY - condY).toBeGreaterThanOrEqual(100);
  });

  // --- showStats: extra vertical spacing ---

  it("should add extra vertical spacing when showStats is true", () => {
    const nodes = [
      makeNode("trigger", "trigger"),
      makeNode("email", "send_email"),
      makeNode("exit", "exit"),
    ];
    const edges = [makeEdge("trigger", "email"), makeEdge("email", "exit")];

    const withoutStats = getLayoutedNodes(nodes, edges);
    const withStats = getLayoutedNodes(nodes, edges, { showStats: true });

    const gapWithout = withoutStats[2].position.y - withoutStats[0].position.y;
    const gapWith = withStats[2].position.y - withStats[0].position.y;

    // Stats padding should increase the total vertical span
    expect(gapWith).toBeGreaterThan(gapWithout);
  });

  it("should add more padding for condition nodes with showStats", () => {
    const nodes = [
      makeNode("trigger", "trigger"),
      makeNode("cond", "condition"),
      makeNode("exit", "exit"),
    ];
    const edges = [makeEdge("trigger", "cond"), makeEdge("cond", "exit")];

    const withoutStats = getLayoutedNodes(nodes, edges);
    const withStats = getLayoutedNodes(nodes, edges, { showStats: true });

    const condWithout = withoutStats.find((n) => n.id === "cond")!;
    const exitWithout = withoutStats.find((n) => n.id === "exit")!;
    const condWith = withStats.find((n) => n.id === "cond")!;
    const exitWith = withStats.find((n) => n.id === "exit")!;

    const gapWithout = exitWithout.position.y - condWithout.position.y;
    const gapWith = exitWith.position.y - condWith.position.y;

    // Condition nodes get more stats padding (60px) than standard nodes (28px)
    expect(gapWith - gapWithout).toBeGreaterThanOrEqual(30);
  });
});
