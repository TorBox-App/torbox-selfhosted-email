"use client";

import { sankey, sankeyLeft, sankeyLinkHorizontal } from "d3-sankey";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildSankeyData } from "./sankey-utils";

type SankeyChartProps = {
  channel: "email" | "sms";
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  complained: number;
  hardBounced: number;
  softBounced: number;
  clicksByUrl?: Array<{ url: string; count: number }>;
};

// Colors keyed by node name
const NODE_COLORS: Record<string, string> = {
  Sent: "hsl(221 83% 53%)", // blue-500
  Delivered: "hsl(262 83% 58%)", // violet-500
  Opened: "hsl(330 81% 60%)", // pink-500
  Clicked: "hsl(25 95% 53%)", // orange-500
  "Hard Bounce": "hsl(0 72% 51%)", // red-600
  "Soft Bounce": "hsl(30 80% 55%)", // amber-500
  Failed: "hsl(0 84% 60%)", // red-500
  Complained: "hsl(0 60% 45%)", // dark red
  "Not Opened": "hsl(215 16% 47%)", // slate-500
  "No Click": "hsl(215 16% 57%)", // slate-400
  Unsubscribe: "hsl(38 92% 50%)", // amber-500
};

const CHART_HEIGHT = 300;
const NODE_WIDTH = 16;
const NODE_PADDING = 14;
const LABEL_MARGIN = 120; // horizontal space reserved for labels on each side
const VERTICAL_PAD = 16; // top/bottom padding so labels aren't clipped

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

type SNode = { name: string };
type SLink = { source: number; target: number; value: number };

export function SankeyChart(props: SankeyChartProps) {
  const data = useMemo(() => buildSankeyData(props), [props]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setChartWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute sankey layout
  const layout = useMemo(() => {
    if (data.nodes.length === 0 || data.links.length === 0) {
      return null;
    }

    const sankeyGen = sankey<SNode, SLink>()
      .nodeId((d) => d.index ?? 0)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyLeft)
      .extent([
        [LABEL_MARGIN, VERTICAL_PAD],
        [chartWidth - LABEL_MARGIN, CHART_HEIGHT - VERTICAL_PAD],
      ]);

    const graph = sankeyGen({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    });

    return graph;
  }, [data, chartWidth]);

  const linkPath = sankeyLinkHorizontal();

  if (!layout) {
    return null;
  }

  return (
    <div className="w-full" ref={containerRef}>
      <svg
        className="w-full overflow-visible"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
        width={chartWidth}
      >
        {/* Links */}
        <g fill="none" strokeOpacity={0.3}>
          {layout.links.map((link, i) => {
            const sourceNode = link.source as unknown as SNode & {
              x0?: number;
              x1?: number;
              y0?: number;
              y1?: number;
            };
            const color = NODE_COLORS[sourceNode.name] ?? "hsl(215 16% 47%)";
            return (
              <path
                d={linkPath(link as never) ?? ""}
                key={i}
                stroke={color}
                strokeWidth={Math.max(1, link.width ?? 1)}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {layout.nodes.map((node, i) => {
            const x0 = node.x0 ?? 0;
            const y0 = node.y0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y1 = node.y1 ?? 0;
            const color = NODE_COLORS[node.name] ?? "hsl(215 16% 47%)";
            const nodeHeight = y1 - y0;
            const nodeWidth = x1 - x0;

            // Label positioning: right of node unless it's past the midpoint
            const isRightHalf = x0 > chartWidth / 2;
            const labelX = isRightHalf ? x0 - 6 : x1 + 6;
            const textAnchor = isRightHalf ? "end" : "start";

            return (
              <g key={i}>
                <rect
                  fill={color}
                  height={Math.max(nodeHeight, 1)}
                  rx={2}
                  width={nodeWidth}
                  x={x0}
                  y={y0}
                />
                <text
                  dominantBaseline="middle"
                  fill="currentColor"
                  fontSize={12}
                  textAnchor={textAnchor}
                  x={labelX}
                  y={y0 + nodeHeight / 2}
                >
                  <tspan fontWeight="600">{node.name}</tspan>
                  <tspan dx={4}>{formatCount(node.value ?? 0)}</tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
