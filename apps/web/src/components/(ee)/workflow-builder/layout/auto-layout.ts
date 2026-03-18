import dagre from "@dagrejs/dagre";
import type { WorkflowEdge, WorkflowNode } from "../use-workflow-store";

const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  trigger: { width: 180, height: 80 },
  send_email: { width: 180, height: 80 },
  send_sms: { width: 180, height: 80 },
  delay: { width: 180, height: 80 },
  exit: { width: 180, height: 80 },
  condition: { width: 130, height: 130 },
  update_contact: { width: 180, height: 80 },
  webhook: { width: 180, height: 80 },
  wait_for_event: { width: 160, height: 80 },
  wait_for_email_engagement: { width: 160, height: 80 },
  subscribe_topic: { width: 180, height: 80 },
  unsubscribe_topic: { width: 180, height: 80 },
  cascade: { width: 220, height: 113 },
};

type LayoutOptions = {
  rankdir?: "TB" | "LR";
  nodesep?: number;
  ranksep?: number;
};

function getNodeDimensions(node: WorkflowNode): {
  width: number;
  height: number;
} {
  // Prefer measured dimensions from React Flow (populated after render)
  const measured = (node as Record<string, unknown>).measured as
    | { width?: number; height?: number }
    | undefined;
  if (measured?.width && measured?.height) {
    return { width: measured.width, height: measured.height };
  }

  // Dynamic cascade height
  if (node.type === "cascade") {
    const channelCount = node.data.cascadeChannels?.length ?? 2;
    return { width: 220, height: 56 + 1 + channelCount * 28 + 16 + 12 };
  }

  // Static fallback
  return NODE_DIMENSIONS[node.type ?? ""] ?? { width: 180, height: 80 };
}

export function getLayoutedNodes(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: LayoutOptions
): WorkflowNode[] {
  if (nodes.length < 2) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options?.rankdir ?? "TB",
    nodesep: options?.nodesep ?? 80,
    ranksep: options?.ranksep ?? 100,
    marginx: 20,
    marginy: 20,
  });

  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node;

    const { width, height } = getNodeDimensions(node);
    return {
      ...node,
      position: {
        x: dagreNode.x - width / 2,
        y: dagreNode.y - height / 2,
      },
    };
  });
}
