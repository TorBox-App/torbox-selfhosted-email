"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactFlow, {
  Background,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

// ============================================================================
// CUSTOM NODE COMPONENTS
// ============================================================================

type NodeData = {
  label: string;
  sublabel?: string;
};

const BaseNode = ({
  children,
  color = "#3b82f6",
  icon,
  label,
  sublabel,
}: {
  children?: React.ReactNode;
  color?: string;
  icon?: string;
  label: string;
  sublabel?: string;
}) => (
  <div className="relative group">
    <div
      className="px-4 py-3 rounded-xl border backdrop-blur-sm transition-all duration-300 group-hover:scale-105"
      style={{
        background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
        borderColor: `${color}40`,
        boxShadow: `0 4px 24px ${color}20`,
      }}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-xl">{icon}</span>}
        <div>
          <div className="font-semibold text-foreground text-sm">{label}</div>
          {sublabel && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {sublabel}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  </div>
);

const SESNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
      id="top"
      position={Position.Top}
      type="target"
    />
    <Handle
      className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
      id="left"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#f97316"
      icon="📧"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
      id="right"
      position={Position.Right}
      type="source"
    />
    <Handle
      className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
      id="bottom"
      position={Position.Bottom}
      type="target"
    />
  </>
);

const SNSNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-pink-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#ec4899"
      icon="🔔"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-pink-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Right}
      type="source"
    />
  </>
);

const SQSNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#a855f7"
      icon="📥"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Right}
      type="source"
    />
  </>
);

const LambdaNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#f59e0b"
      icon="λ"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Right}
      type="source"
    />
  </>
);

const DatabaseNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#10b981"
      icon="🗄️"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Right}
      type="source"
    />
  </>
);

const CloudWatchNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#3b82f6"
      icon="📊"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Right}
      type="source"
    />
  </>
);

const EventBridgeNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-pink-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#ec4899"
      icon="🚌"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-pink-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Right}
      type="source"
    />
  </>
);

const AppNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#06b6d4"
      icon="🖥️"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background"
      position={Position.Right}
      type="source"
    />
  </>
);

const ConfigSetNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-background"
      id="top"
      position={Position.Top}
      type="target"
    />
    <Handle
      className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-background"
      id="left"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#6366f1"
      icon="⚙️"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-background"
      id="bottom"
      position={Position.Bottom}
      type="source"
    />
    <Handle
      className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-background"
      id="right"
      position={Position.Right}
      type="source"
    />
  </>
);

const IPPoolNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-rose-500 !w-3 !h-3 !border-2 !border-background"
      id="top"
      position={Position.Top}
      type="target"
    />
    <Handle
      className="!bg-rose-500 !w-3 !h-3 !border-2 !border-background"
      id="left"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#f43f5e"
      icon="🌐"
      label={data.label}
      sublabel={data.sublabel}
    />
    <Handle
      className="!bg-rose-500 !w-3 !h-3 !border-2 !border-background"
      id="bottom"
      position={Position.Bottom}
      type="source"
    />
    <Handle
      className="!bg-rose-500 !w-3 !h-3 !border-2 !border-background"
      id="right"
      position={Position.Right}
      type="source"
    />
  </>
);

const ISPNode = ({ data }: { data: NodeData }) => (
  <>
    <Handle
      className="!bg-slate-400 !w-3 !h-3 !border-2 !border-background"
      position={Position.Left}
      type="target"
    />
    <BaseNode
      color="#94a3b8"
      icon="📬"
      label={data.label}
      sublabel={data.sublabel}
    />
  </>
);

const nodeTypes = {
  ses: SESNode,
  sns: SNSNode,
  sqs: SQSNode,
  lambda: LambdaNode,
  database: DatabaseNode,
  cloudwatch: CloudWatchNode,
  eventbridge: EventBridgeNode,
  app: AppNode,
  configset: ConfigSetNode,
  ippool: IPPoolNode,
  isp: ISPNode,
};

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "hsl(var(--muted-foreground))",
  },
};

// ============================================================================
// DIAGRAM DATA
// ============================================================================

const overviewNodes: Node<NodeData>[] = [
  {
    id: "app",
    type: "app",
    position: { x: 0, y: 160 },
    data: { label: "Your Application", sublabel: "SDK or SMTP" },
  },
  {
    id: "configset",
    type: "configset",
    position: { x: 250, y: 20 },
    data: { label: "Configuration Set", sublabel: "wraps-email-tracking" },
  },
  {
    id: "ses",
    type: "ses",
    position: { x: 250, y: 160 },
    data: { label: "Amazon SES", sublabel: "Send Email API" },
  },
  {
    id: "ippool",
    type: "ippool",
    position: { x: 250, y: 300 },
    data: { label: "IP Pool", sublabel: "Dedicated/Shared" },
  },
  {
    id: "eventbridge",
    type: "eventbridge",
    position: { x: 520, y: 70 },
    data: { label: "EventBridge", sublabel: "Event Bus" },
  },
  {
    id: "cloudwatch",
    type: "cloudwatch",
    position: { x: 520, y: 210 },
    data: { label: "CloudWatch", sublabel: "Metrics & Alarms" },
  },
  {
    id: "isp",
    type: "isp",
    position: { x: 520, y: 350 },
    data: { label: "ISP Delivery", sublabel: "Gmail, Outlook, etc." },
  },
];

const overviewEdges: Edge[] = [
  { id: "e1", source: "app", target: "ses" },
  {
    id: "e2",
    source: "configset",
    sourceHandle: "bottom",
    target: "ses",
    targetHandle: "top",
    type: "smoothstep",
    style: { strokeDasharray: "5,5" },
  },
  {
    id: "e3",
    source: "ses",
    sourceHandle: "bottom",
    target: "ippool",
    targetHandle: "top",
    type: "smoothstep",
    style: { strokeDasharray: "5,5" },
  },
  { id: "e4", source: "ses", target: "eventbridge" },
  { id: "e5", source: "ses", target: "cloudwatch" },
  { id: "e6", source: "ses", target: "isp" },
];

const bounceNodes: Node<NodeData>[] = [
  {
    id: "ses",
    type: "ses",
    position: { x: 0, y: 80 },
    data: { label: "SES", sublabel: "Email Events" },
  },
  {
    id: "eventbridge",
    type: "eventbridge",
    position: { x: 200, y: 80 },
    data: { label: "EventBridge", sublabel: "Default Bus" },
  },
  {
    id: "sqs",
    type: "sqs",
    position: { x: 400, y: 80 },
    data: { label: "SQS Queue", sublabel: "wraps-email-events" },
  },
  {
    id: "lambda",
    type: "lambda",
    position: { x: 600, y: 80 },
    data: { label: "Lambda", sublabel: "Event Processor" },
  },
  {
    id: "db",
    type: "database",
    position: { x: 800, y: 80 },
    data: { label: "DynamoDB", sublabel: "wraps-email-history" },
  },
  {
    id: "dlq",
    type: "sqs",
    position: { x: 500, y: 220 },
    data: { label: "Dead Letter Queue", sublabel: "Failed after 3 retries" },
  },
  {
    id: "suppression",
    type: "ses",
    position: { x: 100, y: 220 },
    data: { label: "SES Suppression", sublabel: "Config Set Level" },
  },
];

const bounceEdges: Edge[] = [
  { id: "e1", source: "ses", target: "eventbridge" },
  { id: "e2", source: "eventbridge", target: "sqs" },
  { id: "e3", source: "sqs", target: "lambda" },
  { id: "e4", source: "lambda", target: "db" },
  {
    id: "e5",
    source: "sqs",
    target: "dlq",
    style: { strokeDasharray: "5,5", stroke: "#ef4444" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
  },
  {
    id: "e6",
    source: "ses",
    sourceHandle: "bottom",
    target: "suppression",
    targetHandle: "top",
    type: "smoothstep",
    style: { strokeDasharray: "5,5" },
  },
];

const rateLimitNodes: Node<NodeData>[] = [
  {
    id: "app",
    type: "app",
    position: { x: 0, y: 100 },
    data: { label: "Application", sublabel: "Email requests" },
  },
  {
    id: "sqs",
    type: "sqs",
    position: { x: 220, y: 100 },
    data: { label: "SQS Queue", sublabel: "Buffer" },
  },
  {
    id: "lambda",
    type: "lambda",
    position: { x: 440, y: 100 },
    data: { label: "Lambda", sublabel: "Reserved concurrency" },
  },
  {
    id: "ses",
    type: "ses",
    position: { x: 680, y: 100 },
    data: { label: "SES", sublabel: "14 emails/sec" },
  },
  {
    id: "dlq",
    type: "sqs",
    position: { x: 330, y: 240 },
    data: { label: "DLQ", sublabel: "Retry failures" },
  },
  {
    id: "cloudwatch",
    type: "cloudwatch",
    position: { x: 560, y: 240 },
    data: { label: "CloudWatch", sublabel: "Throttle alerts" },
  },
];

const rateLimitEdges: Edge[] = [
  { id: "e1", source: "app", target: "sqs" },
  { id: "e2", source: "sqs", target: "lambda" },
  { id: "e3", source: "lambda", target: "ses" },
  { id: "e4", source: "sqs", target: "dlq", style: { strokeDasharray: "5,5" } },
  {
    id: "e5",
    source: "ses",
    target: "cloudwatch",
    style: { strokeDasharray: "5,5" },
  },
];

const configSetNodes: Node<NodeData>[] = [
  {
    id: "transactional",
    type: "configset",
    position: { x: 0, y: 0 },
    data: { label: "transactional-critical", sublabel: "Password resets, 2FA" },
  },
  {
    id: "marketing",
    type: "configset",
    position: { x: 280, y: 0 },
    data: { label: "marketing-campaigns", sublabel: "Newsletters" },
  },
  {
    id: "notifications",
    type: "configset",
    position: { x: 560, y: 0 },
    data: { label: "notifications-system", sublabel: "Alerts, status" },
  },
  {
    id: "dedicated-trans",
    type: "ippool",
    position: { x: 0, y: 140 },
    data: { label: "IP Pool: Dedicated", sublabel: "$24.95/mo" },
  },
  {
    id: "dedicated-mkt",
    type: "ippool",
    position: { x: 280, y: 140 },
    data: { label: "IP Pool: Managed", sublabel: "$15/mo + volume" },
  },
  {
    id: "shared",
    type: "ippool",
    position: { x: 560, y: 140 },
    data: { label: "IP Pool: Shared", sublabel: "Free" },
  },
];

const configSetEdges: Edge[] = [
  { id: "e1", source: "transactional", target: "dedicated-trans" },
  { id: "e2", source: "marketing", target: "dedicated-mkt" },
  { id: "e3", source: "notifications", target: "shared" },
];

// ============================================================================
// DIAGRAM REGISTRY
// ============================================================================

const diagrams = {
  overview: { nodes: overviewNodes, edges: overviewEdges },
  bounce: { nodes: bounceNodes, edges: bounceEdges },
  rateLimit: { nodes: rateLimitNodes, edges: rateLimitEdges },
  configSet: { nodes: configSetNodes, edges: configSetEdges },
};

// ============================================================================
// EXPORTED COMPONENTS
// ============================================================================

export const FlowDiagram = ({
  diagram,
  title,
  height = 350,
}: {
  diagram: keyof typeof diagrams;
  title: string;
  height?: number;
}) => {
  const d = diagrams[diagram];
  const [nodesState] = useNodesState(d.nodes);
  const [edgesState] = useEdgesState(d.edges);

  return (
    <div className="my-8 rounded-xl overflow-hidden border bg-muted/30">
      <div className="px-4 py-3 border-b bg-muted/50">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      </div>
      <div style={{ height }}>
        <ReactFlow
          defaultEdgeOptions={defaultEdgeOptions}
          edges={edgesState}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          nodes={nodesState}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={nodeTypes}
          panOnDrag={false}
          proOptions={{ hideAttribution: true }}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          zoomOnScroll={false}
        >
          <Background
            color="hsl(var(--muted-foreground) / 0.15)"
            gap={24}
            size={1}
          />
        </ReactFlow>
      </div>
    </div>
  );
};

export const CodeBlock = ({
  code,
  language = "javascript",
  title,
}: {
  code: string;
  language?: string;
  title?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border bg-muted/30">
      <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            {language}
          </span>
          {title && (
            <span className="text-xs text-muted-foreground">{title}</span>
          )}
        </div>
        <button
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
            copied
              ? "bg-green-500/20 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-foreground/80 font-mono leading-relaxed">
          {code}
        </code>
      </pre>
    </div>
  );
};

export const SectionNav = ({
  sections,
}: {
  sections: { id: string; title: string }[];
}) => {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  const scrollToSection = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="sticky top-24 hidden xl:block w-56 shrink-0">
      <div className="p-4 rounded-xl border bg-muted/30 backdrop-blur-sm">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          On this page
        </h4>
        <ul className="space-y-1">
          {sections.map((s, i) => (
            <li key={i}>
              <button
                className={`text-sm w-full text-left px-3 py-1.5 rounded-lg transition-colors ${
                  active === s.id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                onClick={() => scrollToSection(s.id)}
                type="button"
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};
