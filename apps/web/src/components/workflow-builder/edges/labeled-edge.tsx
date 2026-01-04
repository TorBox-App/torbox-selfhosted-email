"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Determine label and color based on source handle
  let label = "";
  let labelColor = "bg-gray-100 text-gray-600";

  if (sourceHandleId === "yes") {
    label = "Yes";
    labelColor = "bg-green-100 text-green-700";
  } else if (sourceHandleId === "no") {
    label = "No";
    labelColor = "bg-red-100 text-red-700";
  } else if (sourceHandleId === "timeout") {
    label = "Timeout";
    labelColor = "bg-yellow-100 text-yellow-700";
  } else if (sourceHandleId === "default") {
    label = "Default";
    labelColor = "bg-gray-100 text-gray-600";
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: sourceHandleId === "yes" ? "#22c55e" : sourceHandleId === "no" ? "#ef4444" : "#9ca3af",
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <div
              className={`px-2 py-0.5 rounded text-xs font-medium ${labelColor}`}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
