import {
  getSmartEdge,
  pathfindingJumpPointNoDiagonal,
  svgDrawSmoothLinePath,
} from "@jalez/react-flow-smart-edge";
import type { Node, Position } from "@xyflow/react";

type ComputeSmartPathParams = {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  nodes: Node[];
};

type SmartPathResult = {
  svgPath: string;
  labelX: number;
  labelY: number;
};

/** Node count above which smart routing is skipped for performance. */
const SMART_ROUTING_NODE_LIMIT = 35;

export function computeSmartPath(
  params: ComputeSmartPathParams
): SmartPathResult | null {
  const {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    nodes,
  } = params;

  if (nodes.length === 0) {
    return null;
  }

  if (nodes.length > SMART_ROUTING_NODE_LIMIT) {
    return null;
  }

  const result = getSmartEdge({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    nodes,
    options: {
      nodePadding: 10,
      gridRatio: 15,
      drawEdge: svgDrawSmoothLinePath,
      generatePath: pathfindingJumpPointNoDiagonal,
    },
  });

  if (!result) {
    return null;
  }

  return {
    svgPath: result.svgPathString,
    labelX: result.edgeCenterX,
    labelY: result.edgeCenterY,
  };
}
