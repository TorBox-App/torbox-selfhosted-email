import type {
  CanvasViewport,
  TriggerConfig,
  Workflow,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepType,
  WorkflowTransition,
  WorkflowTriggerType,
} from "@wraps/db";
import type { Connection, Edge, Node, OnConnect, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
} from "@xyflow/react";
import { create } from "zustand";
import { validateWorkflow, type ValidationError, type ValidationResult } from "@/lib/workflow-validation";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowNodeData = {
  stepId: string;
  type: WorkflowStepType;
  name: string;
  config: WorkflowStepConfig;
  isValid: boolean;
  errorMessage?: string;
};

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge<{ label?: string }>;

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

interface WorkflowStoreState {
  // Workflow metadata
  workflow: Workflow | null;
  isDirty: boolean;
  isSaving: boolean;

  // React Flow state
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // UI state
  selectedNodeId: string | null;

  // Validation state
  validationResult: ValidationResult | null;

  // Actions
  setWorkflow: (workflow: Workflow) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange<WorkflowEdge>;
  onConnect: OnConnect;
  onReconnect: (oldEdge: WorkflowEdge, newConnection: Connection) => void;

  addNode: (
    type: WorkflowStepType,
    position: { x: number; y: number },
    config?: Partial<WorkflowStepConfig>
  ) => string;
  updateNodeConfig: (nodeId: string, config: Partial<WorkflowStepConfig>) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;

  selectNode: (nodeId: string | null) => void;

  // Workflow actions
  updateWorkflowSettings: (settings: {
    name?: string;
    description?: string;
    triggerType?: WorkflowTriggerType;
    triggerConfig?: TriggerConfig;
    allowReentry?: boolean;
    reentryDelaySeconds?: number | null;
  }) => void;

  // Serialization
  getWorkflowDefinition: () => {
    steps: WorkflowStep[];
    transitions: WorkflowTransition[];
    canvasViewport: CanvasViewport;
  };

  setIsSaving: (isSaving: boolean) => void;
  markClean: () => void;

  // Update workflow after save without touching nodes/edges (avoids re-triggering dirty state)
  updateWorkflowAfterSave: (workflow: Workflow) => void;

  // Validation
  runValidation: () => ValidationResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert workflow steps to React Flow nodes
 */
function stepsToNodes(steps: WorkflowStep[]): WorkflowNode[] {
  return steps.map((step) => ({
    id: step.id,
    type: step.type,
    position: step.position,
    data: {
      stepId: step.id,
      type: step.type,
      name: step.name,
      config: step.config,
      isValid: true,
    },
  }));
}

/**
 * Convert workflow transitions to React Flow edges
 */
function transitionsToEdges(transitions: WorkflowTransition[]): WorkflowEdge[] {
  return transitions.map((transition) => ({
    id: transition.id,
    source: transition.fromStepId,
    target: transition.toStepId,
    sourceHandle: transition.condition?.branch,
    data: {
      label: transition.condition?.branch,
    },
  }));
}

/**
 * Convert React Flow nodes to workflow steps
 */
function nodesToSteps(nodes: WorkflowNode[]): WorkflowStep[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.data.type,
    name: node.data.name,
    position: node.position,
    config: node.data.config,
  }));
}

/**
 * Convert React Flow edges to workflow transitions
 */
function edgesToTransitions(edges: WorkflowEdge[]): WorkflowTransition[] {
  return edges.map((edge) => ({
    id: edge.id,
    fromStepId: edge.source,
    toStepId: edge.target,
    condition: edge.sourceHandle
      ? { branch: edge.sourceHandle as "yes" | "no" | "timeout" | "default" }
      : undefined,
  }));
}

/**
 * Get default config for a step type
 */
function getDefaultConfig(type: WorkflowStepType): WorkflowStepConfig {
  switch (type) {
    case "trigger":
      return { type: "trigger", triggerType: "event" };
    case "send_email":
      return { type: "send_email", templateId: "" };
    case "send_sms":
      return { type: "send_sms" };
    case "delay":
      return { type: "delay", amount: 1, unit: "days" };
    case "exit":
      return { type: "exit" };
    case "condition":
      return { type: "condition", field: "", operator: "equals", value: "" };
    case "webhook":
      return { type: "webhook", url: "", method: "POST" };
    case "update_contact":
      return { type: "update_contact", updates: [] };
    case "wait_for_event":
      return { type: "wait_for_event", eventName: "" };
    case "wait_for_email_engagement":
      return { type: "wait_for_email_engagement", timeoutSeconds: 259200 }; // 3 days default
    case "subscribe_topic":
      return { type: "subscribe_topic", topicId: "", channel: "email" };
    case "unsubscribe_topic":
      return { type: "unsubscribe_topic", topicId: "", channel: "email" };
  }
}

/**
 * Get default name for a step type
 */
function getDefaultName(type: WorkflowStepType): string {
  switch (type) {
    case "trigger":
      return "Trigger";
    case "send_email":
      return "Send Email";
    case "send_sms":
      return "Send SMS";
    case "delay":
      return "Delay";
    case "exit":
      return "Exit";
    case "condition":
      return "Condition";
    case "webhook":
      return "Webhook";
    case "update_contact":
      return "Update Contact";
    case "wait_for_event":
      return "Wait for Event";
    case "wait_for_email_engagement":
      return "Email Engagement";
    case "subscribe_topic":
      return "Topic";
    case "unsubscribe_topic":
      return "Topic";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export const useWorkflowStore = create<WorkflowStoreState>((set, get) => ({
  // Initial state
  workflow: null,
  isDirty: false,
  isSaving: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  validationResult: null,

  // Actions
  setWorkflow: (workflow) => {
    const steps = workflow.steps as WorkflowStep[];
    const transitions = workflow.transitions as WorkflowTransition[];

    set({
      workflow,
      nodes: stepsToNodes(steps),
      edges: transitionsToEdges(transitions),
      isDirty: false,
      selectedNodeId: null,
    });
  },

  setNodes: (nodes) => {
    set({ nodes, isDirty: true });
  },

  setEdges: (edges) => {
    set({ edges, isDirty: true });
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: crypto.randomUUID(),
        },
        state.edges
      ),
      isDirty: true,
    }));
  },

  onReconnect: (oldEdge, newConnection) => {
    set((state) => ({
      edges: reconnectEdge(oldEdge, newConnection, state.edges),
      isDirty: true,
    }));
  },

  addNode: (type, position, config) => {
    const id = crypto.randomUUID();
    const defaultConfig = getDefaultConfig(type);
    const mergedConfig = config
      ? { ...defaultConfig, ...config }
      : defaultConfig;

    const newNode: WorkflowNode = {
      id,
      type,
      position,
      data: {
        stepId: id,
        type,
        name: getDefaultName(type),
        config: mergedConfig as WorkflowStepConfig,
        isValid: true,
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      isDirty: true,
      selectedNodeId: id,
    }));

    return id;
  },

  updateNodeConfig: (nodeId, config) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config: { ...node.data.config, ...config } as WorkflowStepConfig,
              },
            }
          : node
      ),
      isDirty: true,
    }));
  },

  updateNodeName: (nodeId, name) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                name,
              },
            }
          : node
      ),
      isDirty: true,
    }));
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  updateWorkflowSettings: (settings) => {
    set((state) => {
      if (!state.workflow) return state;

      return {
        workflow: {
          ...state.workflow,
          ...settings,
        },
        isDirty: true,
      };
    });
  },

  getWorkflowDefinition: () => {
    const state = get();
    return {
      steps: nodesToSteps(state.nodes),
      transitions: edgesToTransitions(state.edges),
      canvasViewport: { x: 0, y: 0, zoom: 1 },
    };
  },

  setIsSaving: (isSaving) => {
    set({ isSaving });
  },

  markClean: () => {
    set({ isDirty: false });
  },

  updateWorkflowAfterSave: (workflow) => {
    // Only update workflow metadata, don't touch nodes/edges
    // This prevents React Flow from firing change events that would set isDirty=true
    set({ workflow, isDirty: false });
  },

  runValidation: () => {
    const state = get();
    const steps = nodesToSteps(state.nodes);
    const transitions = edgesToTransitions(state.edges);
    const result = validateWorkflow(steps, transitions);

    // Only update validationResult, don't touch nodes to avoid infinite loops
    // Node components should read their validation status from validationResult.errorsByNodeId
    set({ validationResult: result });
    return result;
  },
}));

// Selector hooks for common state slices
export const useSelectedNode = () => {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const nodes = useWorkflowStore((state) => state.nodes);
  return selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId)
    : null;
};

export const useIsDirty = () => useWorkflowStore((state) => state.isDirty);
export const useIsSaving = () => useWorkflowStore((state) => state.isSaving);
export const useValidationResult = () => useWorkflowStore((state) => state.validationResult);

export const useNodeValidation = (nodeId: string) => {
  const validationResult = useWorkflowStore((state) => state.validationResult);
  if (!validationResult) return { isValid: true, errorMessage: undefined };

  const errors = validationResult.errorsByNodeId.get(nodeId) || [];
  const hasError = errors.some((e) => e.severity === "error");
  const errorMessage = errors
    .filter((e) => e.severity === "error")
    .map((e) => e.message)
    .join(", ");

  return { isValid: !hasError, errorMessage: errorMessage || undefined };
};

// Re-export validation types for convenience
export type { ValidationError, ValidationResult } from "@/lib/workflow-validation";
