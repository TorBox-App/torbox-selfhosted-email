"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Lightbulb,
} from "lucide-react";
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
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
// UI COMPONENTS
// ============================================================================

const FlowDiagram = ({
  nodes,
  edges,
  title,
  height = 350,
}: {
  nodes: Node<NodeData>[];
  edges: Edge[];
  title: string;
  height?: number;
}) => {
  const [nodesState] = useNodesState(nodes);
  const [edgesState] = useEdgesState(edges);

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

const CodeBlock = ({
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

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="my-6 overflow-x-auto rounded-xl border">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/50">
          {headers.map((h, i) => (
            <th
              className="px-4 py-3 text-left font-semibold text-foreground border-b"
              key={i}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
            key={i}
          >
            {row.map((cell, j) => (
              <td className="px-4 py-3 text-muted-foreground" key={j}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Callout = ({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "danger" | "success";
  title: string;
  children: React.ReactNode;
}) => {
  const styles = {
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      icon: <Lightbulb className="h-4 w-4" />,
      text: "text-blue-600 dark:text-blue-400",
    },
    warning: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      icon: <AlertTriangle className="h-4 w-4" />,
      text: "text-amber-600 dark:text-amber-400",
    },
    danger: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      icon: <AlertTriangle className="h-4 w-4" />,
      text: "text-red-600 dark:text-red-400",
    },
    success: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      icon: <CheckCircle className="h-4 w-4" />,
      text: "text-emerald-600 dark:text-emerald-400",
    },
  };
  const s = styles[type];

  return (
    <div className={`my-6 p-4 rounded-xl border ${s.bg} ${s.border}`}>
      <div className={`flex items-center gap-2 font-semibold ${s.text} mb-2`}>
        {s.icon}
        <span>{title}</span>
      </div>
      <div className="text-foreground/80 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
};

const SectionNav = ({
  sections,
  active,
  onSelect,
}: {
  sections: { id: string; title: string }[];
  active: string;
  onSelect: (id: string) => void;
}) => (
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
              onClick={() => onSelect(s.id)}
            >
              {s.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </nav>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SESProductionArchitecture() {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", title: "Overview" },
    { id: "dedicated-ips", title: "Dedicated IPs" },
    { id: "config-sets", title: "Configuration Sets" },
    { id: "bounce-handling", title: "Bounce Handling" },
    { id: "rate-limiting", title: "Rate Limiting" },
    { id: "monitoring", title: "Monitoring" },
    { id: "mistakes", title: "Common Mistakes" },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />

      {/* Hero */}
      <header className="relative overflow-hidden border-b pb-16 pt-24">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative mx-auto px-4">
          <Badge className="mb-4" variant="outline">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            Production Guide
          </Badge>
          <h1 className="mb-4 max-w-3xl font-bold text-4xl tracking-tight md:text-5xl">
            AWS SES Production{" "}
            <span className="text-primary">Architecture Guide</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Everything you need to deploy SES at scale: dedicated IPs, bounce
            handling, rate limiting, and the patterns that protect your sender
            reputation—and keep your emails out of spam folders.
          </p>
          <div className="flex items-center gap-4 mt-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              15 min read
            </span>
            <span>•</span>
            <span>Last updated January 2026</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-16">
        <div className="flex gap-12">
          <SectionNav
            active={activeSection}
            onSelect={scrollToSection}
            sections={sections}
          />

          <article className="flex-1 max-w-3xl space-y-16">
            {/* Overview */}
            <section className="scroll-mt-24" id="overview">
              <h2 className="text-2xl font-bold mb-4">
                The Production SES Stack
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Amazon SES is deceptively simple to start with—verify a domain,
                call the API, emails flow. But production deployments need
                supporting infrastructure: EventBridge routes events, SQS
                ensures durability, Lambda processes data, and CloudWatch
                monitors health. Without these, you're flying blind when
                deliverability drops.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Here's what a production-ready SES architecture looks like—and
                what Wraps deploys to your AWS account:
              </p>

              <FlowDiagram
                edges={overviewEdges}
                height={420}
                nodes={overviewNodes}
                title="Production SES Architecture (What Wraps Deploys)"
              />

              <p className="text-muted-foreground leading-relaxed mb-4">
                Your application sends through SES using the{" "}
                <code className="text-primary">@wraps.dev/email</code> SDK,
                which routes emails through your configured IP pool. All 10 SES
                event types flow to EventBridge for processing, enabling
                real-time tracking and reputation monitoring. The configuration
                set <code className="text-primary">wraps-email-tracking</code>{" "}
                ties it all together.
              </p>

              <Callout title="What Wraps Deploys" type="success">
                One command (
                <code className="text-emerald-400">wraps email init</code>)
                deploys this entire architecture to your AWS account: IAM roles
                with OIDC authentication, SES configuration set with all 10
                event types, EventBridge rules, SQS queues with DLQ, Lambda
                processor, and DynamoDB for event history. All tagged with{" "}
                <code className="text-emerald-400">ManagedBy: wraps-cli</code>.
              </Callout>

              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-foreground/90 text-sm">
                  <strong>Before you start:</strong> Make sure your domain has
                  proper email authentication configured.{" "}
                  <a className="text-primary hover:underline" href="/blog/your-dmarc-policy-is-useless">
                    Check your DMARC policy
                  </a>{" "}
                  and{" "}
                  <a className="text-primary hover:underline" href="/tools">
                    verify your DNS records
                  </a>{" "}
                  are correct before deploying production infrastructure.
                </p>
              </div>
            </section>

            {/* Dedicated IPs */}
            <section className="scroll-mt-24" id="dedicated-ips">
              <h2 className="text-2xl font-bold mb-4">
                Dedicated IPs: When & Why
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                SES offers three IP strategies with distinct economics. Shared
                IPs work for most startups, but high-volume senders need
                dedicated IPs to isolate their reputation. On shared IPs, if
                another sender gets flagged for spam, your deliverability
                suffers too—even if you did nothing wrong.
              </p>

              <Table
                headers={["Strategy", "Cost", "Best For", "Warmup Required"]}
                rows={[
                  [
                    "Shared IPs",
                    "Free",
                    "<100K emails/day, variable volume",
                    "None",
                  ],
                  [
                    "Dedicated Standard",
                    "$24.95/IP/month",
                    "Consistent high volume",
                    "45 days auto-warmup",
                  ],
                  [
                    "Dedicated Managed",
                    "$15/mo + tiered",
                    "Variable volume, multiple ISPs",
                    "Automatic per-ISP",
                  ],
                ]}
              />

              <p className="text-muted-foreground text-sm mt-4">
                See our{" "}
                <a className="text-primary hover:underline" href="/pricing">
                  pricing page
                </a>{" "}
                for full cost breakdowns including Wraps platform features.
              </p>

              <Callout title="IP Warming Reality Check" type="warning">
                New dedicated IPs typically need consistent daily volume per
                major ISP to maintain reputation—AWS recommends ramping
                gradually over 45 days. Drop below your established volume and
                the IP cools off, requiring re-warming. Managed IPs solve this
                by auto-routing overflow through shared pools.
              </Callout>

              <h3 className="text-xl font-semibold mt-8 mb-4">
                Warming Schedule
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Standard dedicated IPs warm automatically over 45 days. Here's
                the typical progression:
              </p>

              <Table
                headers={["Week", "Daily Volume per ISP", "Total Daily"]}
                rows={[
                  ["Week 1", "50-200", "~1,000"],
                  ["Week 2", "200-1,000", "~4,000"],
                  ["Week 3", "1,000-5,000", "~20,000"],
                  ["Week 4", "5,000-20,000", "~80,000"],
                  ["Week 5-6", "20,000-50,000", "~200,000"],
                ]}
              />
            </section>

            {/* Configuration Sets */}
            <section className="scroll-mt-24" id="config-sets">
              <h2 className="text-2xl font-bold mb-4">
                Configuration Set Architecture
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Configuration sets let you separate email types so they don't
                affect each other's reputation. A promotional campaign with high
                unsubscribes won't hurt your password reset deliverability. Each
                set controls its own event tracking, IP routing, and suppression
                behavior. Large deployments use 3-6 configuration sets for
                different email types.
              </p>

              <FlowDiagram
                edges={configSetEdges}
                height={280}
                nodes={configSetNodes}
                title="Configuration Set → IP Pool Mapping"
              />

              <Callout title="Wraps Configuration Set" type="success">
                Wraps creates a single configuration set{" "}
                <code className="text-emerald-400">wraps-email-tracking</code>{" "}
                that captures all 10 event types. It includes: EventBridge
                destination for event routing, bounce & complaint suppression at
                the config set level, optional TLS enforcement, and optional
                custom tracking domain for branded click/open tracking URLs.
              </Callout>

              <CodeBlock
                code={`├── wraps-email-tracking       # Wraps default config set
│   └── Event Destination: EventBridge (all 10 event types)
│   └── Suppression: Bounces + Complaints (config set level)
│   └── TLS: Required (optional)
│   └── Tracking Domain: track.yourdomain.com (optional)
│
# For advanced use cases, you can create additional sets:
├── transactional-critical    # Password resets, 2FA codes
│   └── IP Pool: dedicated-transactional
│
└── marketing-campaigns       # Newsletters, promotions
    └── IP Pool: dedicated-marketing`}
                language="text"
                title="Wraps configuration set structure"
              />

              <Callout title="Suppression Override Gotcha" type="danger">
                Configuration set suppression settings are <em>overrides</em>,
                not separate lists. Setting "disable suppression" doesn't give
                you a clean slate—it bypasses your entire account suppression
                list, potentially sending to known-bad addresses.
              </Callout>
            </section>

            {/* Bounce Handling */}
            <section className="scroll-mt-24" id="bounce-handling">
              <h2 className="text-2xl font-bold mb-4">
                Event Processing Pipeline
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                AWS pauses sending at{" "}
                <strong className="text-foreground">10% bounce rate</strong> or{" "}
                <strong className="text-foreground">0.5% complaint rate</strong>
                . Cross these thresholds and your account goes under
                review—emails stop flowing while you scramble to fix it. A
                robust event processing pipeline catches problems early through
                real-time analysis and automatic suppression.
              </p>

              <FlowDiagram
                edges={bounceEdges}
                height={320}
                nodes={bounceNodes}
                title="Event Processing Pipeline (Wraps Architecture)"
              />

              <Callout title="Wraps Event Processing" type="success">
                Wraps captures all 10 SES event types: SEND, DELIVERY, OPEN,
                CLICK, BOUNCE, COMPLAINT, REJECT, RENDERING_FAILURE,
                DELIVERY_DELAY, and SUBSCRIPTION. Events are stored in DynamoDB
                with configurable retention (default 90 days) and automatic TTL
                cleanup. Suppression is handled at the configuration set
                level—bounced and complained addresses are automatically
                blocked.
              </Callout>

              <Table
                headers={[
                  "Metric",
                  "Target",
                  "Warning Alert",
                  "Critical Alert",
                  "AWS Review",
                ]}
                rows={[
                  ["Bounce Rate", "<2%", "2%", "4%", "5%"],
                  ["Complaint Rate", "<0.05%", "0.05%", "0.08%", "0.1%"],
                ]}
              />

              <h3 className="text-xl font-semibold mt-8 mb-4">
                How Wraps Processes Events
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Lambda processor receives batches of 10 events from SQS,
                parses the EventBridge envelope, and stores normalized data in
                DynamoDB. Here's the key processing logic:
              </p>
              <CodeBlock
                code={`// Wraps Lambda Event Processor (simplified)
export async function handler(event) {
  const results = [];

  for (const record of event.Records) {
    try {
      const eventBridgeEvent = JSON.parse(record.body);
      const sesEvent = eventBridgeEvent.detail;

      // Extract common fields
      const messageId = sesEvent.mail.messageId;
      const eventType = sesEvent.eventType;
      const timestamp = new Date(sesEvent.mail.timestamp).getTime();

      // Normalize event data based on type
      const eventData = {
        messageId,
        sentAt: timestamp,
        accountId: process.env.AWS_ACCOUNT_ID,
        from: sesEvent.mail.source,
        to: sesEvent.mail.destination,
        subject: sesEvent.mail.commonHeaders?.subject,
        eventType: normalizeEventType(sesEvent),
        eventData: sesEvent,
        expiresAt: computeTTL(timestamp, RETENTION_DAYS),
      };

      await dynamodb.put({
        TableName: 'wraps-email-history',
        Item: eventData,
      });

      results.push({ itemIdentifier: record.messageId });
    } catch (error) {
      // Failed items go to DLQ after 3 retries
      console.error('Failed to process:', error);
    }
  }

  return { batchItemFailures: results };
}`}
                language="javascript"
                title="event-processor.js"
              />
            </section>

            {/* Rate Limiting */}
            <section className="scroll-mt-24" id="rate-limiting">
              <h2 className="text-2xl font-bold mb-4">
                Rate Limiting Architecture
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                SES quotas use rolling 24-hour windows—your limit resets
                continuously, not at midnight. Default production quotas start
                around 50,000 emails/day and 14 emails/second. Without a buffer,
                a sudden spike in signups exhausts your quota and delays
                critical emails like password resets. Queue-based architectures
                absorb bursts so SES processes them at a sustainable rate.
              </p>

              <FlowDiagram
                edges={rateLimitEdges}
                height={320}
                nodes={rateLimitNodes}
                title="Queue-Based Rate Limiting"
              />

              <h3 className="text-xl font-semibold mt-8 mb-4">
                SQS + Lambda Configuration
              </h3>
              <CodeBlock
                code={`functions:
  emailSender:
    handler: sender.handler
    reservedConcurrency: 5  # SES rate / batch size / safety factor
    events:
      - sqs:
          arn: !GetAtt EmailQueue.Arn
          batchSize: 10
          functionResponseTypes:
            - ReportBatchItemFailures

resources:
  Resources:
    EmailQueue:
      Type: AWS::SQS::Queue
      Properties:
        VisibilityTimeout: 180  # 6x Lambda timeout
        MessageRetentionPeriod: 1209600  # 14 days
        RedrivePolicy:
          deadLetterTargetArn: !GetAtt EmailDLQ.Arn
          maxReceiveCount: 5`}
                language="yaml"
                title="serverless.yml"
              />

              <Callout title="Concurrency Math" type="info">
                If your SES rate limit is 14/sec and you process 10 emails per
                Lambda invocation, set{" "}
                <code className="text-primary">reservedConcurrency</code> to{" "}
                <code className="text-primary">(14 / 10) * 0.8 ≈ 1-2</code>. The
                0.8 factor prevents hitting limits during retry bursts.
              </Callout>
            </section>

            {/* Monitoring */}
            <section className="scroll-mt-24" id="monitoring">
              <h2 className="text-2xl font-bold mb-4">CloudWatch Monitoring</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Essential alarms catch reputation problems before AWS
                intervenes. These Terraform configurations create early-warning
                alerts:
              </p>

              <CodeBlock
                code={`resource "aws_cloudwatch_metric_alarm" "ses_bounce_rate" {
  alarm_name          = "ses-bounce-rate-warning"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Reputation.BounceRate"
  namespace           = "AWS/SES"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0.02  # 2% - warns before AWS review (5%)
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "ses_complaint_rate" {
  alarm_name          = "ses-complaint-rate-warning"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Reputation.ComplaintRate"
  namespace           = "AWS/SES"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0.0005  # 0.05% - warns before AWS (0.1%) and Gmail (0.3%)
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}`}
                language="hcl"
                title="ses-alarms.tf"
              />

              <Callout title="Or configure with Wraps CLI" type="success">
                Skip the Terraform—enable these same alerts in one command:{" "}
                <code className="text-emerald-400">wraps email upgrade</code> →
                "Enable reputation alerts". Wraps deploys 5 CloudWatch alarms
                with thresholds that warn <em>before</em> AWS takes action:
                bounce rate at 2%/4% (vs AWS 5%/10%), complaint rate at
                0.05%/0.08% (vs AWS 0.1%/0.5%), plus DLQ monitoring. You'll get
                email notifications when your reputation needs attention.
              </Callout>

              <h3 className="text-xl font-semibold mt-8 mb-4">
                Dashboard Metrics
              </h3>
              <Table
                headers={["Widget", "Metrics", "Purpose"]}
                rows={[
                  [
                    "Reputation",
                    "BounceRate, ComplaintRate",
                    "Account health at a glance",
                  ],
                  [
                    "Delivery Funnel",
                    "Send, Delivery, Bounce, Complaint",
                    "Conversion through stages",
                  ],
                  [
                    "Throughput",
                    "Send rate over time",
                    "Detect throttling patterns",
                  ],
                  [
                    "ISP Breakdown",
                    "VDM metrics by domain",
                    "Per-provider performance",
                  ],
                ]}
              />
            </section>

            {/* Common Mistakes */}
            <section className="scroll-mt-24" id="mistakes">
              <h2 className="text-2xl font-bold mb-4">
                Common Mistakes That Kill Deliverability
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                These mistakes can wreck months of careful reputation building.
                We've seen them tank otherwise healthy sender accounts:
              </p>

              <p className="text-muted-foreground text-sm mb-6">
                <strong>Related:</strong>{" "}
                <a className="text-primary hover:underline" href="/blog/your-dmarc-policy-is-useless">
                  Why your DMARC policy is useless
                </a>{" "}
                covers SPF/DKIM alignment in detail, and our{" "}
                <a className="text-primary hover:underline" href="/blog/spf-guide">
                  SPF configuration guide
                </a>{" "}
                explains the include mechanism.
              </p>

              <div className="space-y-4">
                {[
                  {
                    title: "Missing Custom MAIL FROM",
                    desc: "SPF alignment fails without it, causing DMARC failures even with valid SPF records. See our DMARC guide for proper alignment.",
                  },
                  {
                    title: "Testing with real addresses",
                    desc: "Use bounce@simulator.amazonses.com for testing—real bounces hurt your reputation. Learn proper testing in our sandbox guide.",
                  },
                  {
                    title: "Ignoring soft bounces",
                    desc: "Repeatedly sending to soft-bouncing addresses signals poor list hygiene to ISPs.",
                  },
                  {
                    title: "Sudden volume spikes",
                    desc: "ISPs interpret sudden increases as spam behavior. Scale gradually—doubling overnight is a red flag.",
                  },
                  {
                    title: "Region confusion",
                    desc: "SES credentials, quotas, and domains are region-specific. Verified in us-east-1 ≠ verified in eu-west-1.",
                  },
                ].map((item, i) => (
                  <div
                    className="p-4 rounded-xl border border-red-500/20 bg-red-500/5"
                    key={i}
                  >
                    <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">
                      {item.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Continue Learning */}
            <section className="mt-16">
              <h2 className="text-2xl font-bold mb-6">Continue Learning</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <a
                  className="group p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
                  href="/blog/ses-sandbox-guide"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    AWS SES Sandbox Exit Guide
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Step-by-step guide to getting production access with proper DNS configuration.
                  </p>
                </a>
                <a
                  className="group p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
                  href="/blog/your-dmarc-policy-is-useless"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Fix Your DMARC Policy
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Most DMARC policies don't protect you. Learn what actually works.
                  </p>
                </a>
                <a
                  className="group p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
                  href="/platform"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Wraps Platform Dashboard
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Monitor deliverability, track events, and manage your email infrastructure.
                  </p>
                </a>
                <a
                  className="group p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
                  href="/docs/guides/domain-verification"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Domain Verification Guide
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure DKIM, SPF, and DMARC records for your sending domain.
                  </p>
                </a>
              </div>
            </section>

            {/* CTA */}
            <section className="mt-20 p-8 rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-primary/5 text-center">
              <h3 className="text-2xl font-bold mb-3">
                Skip the infrastructure headaches
              </h3>
              <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
                <code className="text-primary">wraps email init</code> deploys 7
                AWS resources to your account: IAM roles, SES configuration,
                EventBridge rules, SQS queues, Lambda processor, and DynamoDB
                storage. All wired together and ready to send.
              </p>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto text-sm">
                You own everything—no vendor lock-in. Pay only AWS pricing
                (~$0.10 per 1,000 emails). Don't like it?{" "}
                <code className="text-primary">wraps email destroy</code>{" "}
                removes everything cleanly.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button asChild size="lg">
                  <a href="/docs/quickstart/email">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="/cli">View All Resources Deployed</a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                You'll need: AWS credentials and a verified domain. That's it.
              </p>
            </section>
          </article>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
