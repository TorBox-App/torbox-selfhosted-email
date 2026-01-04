"use client";

import type { WorkflowStepType } from "@wraps/db";
import type { EdgeTypes, Node, NodeTypes, OnConnect, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef, useState } from "react";
import { LabeledEdge } from "./edges/labeled-edge";
import { NodePalette } from "./node-palette";
import {
  ConditionNode,
  DelayNode,
  ExitNode,
  SendEmailNode,
  SendSmsNode,
  SubscribeTopicNode,
  TriggerNode,
  UnsubscribeTopicNode,
  UpdateContactNode,
  WaitForEventNode,
  WebhookNode,
} from "./nodes";
import { useWorkflowStore } from "./use-workflow-store";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  send_email: SendEmailNode,
  send_sms: SendSmsNode,
  delay: DelayNode,
  exit: ExitNode,
  condition: ConditionNode,
  update_contact: UpdateContactNode,
  webhook: WebhookNode,
  // Slice 3
  wait_for_event: WaitForEventNode,
  subscribe_topic: SubscribeTopicNode,
  unsubscribe_topic: UnsubscribeTopicNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange) as OnNodesChange<Node>;
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange) as OnEdgesChange;
  const onConnect = useWorkflowStore((state) => state.onConnect) as OnConnect;
  const addNode = useWorkflowStore((state) => state.addNode);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);

  const nodesWithSelection = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [nodes, selectedNodeId]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as WorkflowStepType;

      if (!type || !reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      addNode(type, position);
    },
    [reactFlowInstance, addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const handleAddNode = useCallback(
    (type: WorkflowStepType) => {
      // Add node at center of viewport
      if (reactFlowInstance) {
        const { x, y, zoom } = reactFlowInstance.getViewport();
        const centerX = (-x + window.innerWidth / 2) / zoom;
        const centerY = (-y + window.innerHeight / 2) / zoom;
        addNode(type, { x: centerX - 90, y: centerY - 40 });
      } else {
        addNode(type, { x: 250, y: 100 });
      }
    },
    [reactFlowInstance, addNode]
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: "labeled",
          animated: true,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-white !border !shadow-sm"
        />
      </ReactFlow>
      <NodePalette onAddNode={handleAddNode} />
    </div>
  );
}
