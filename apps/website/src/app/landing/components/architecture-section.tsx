"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  Code2,
  Mail,
  Database,
  Zap,
  Users,
  BarChart3,
  Server,
  Inbox,
  MousePointerClick,
  Eye,
  AlertTriangle,
  Clock,
  Shield,
  ArrowRight,
} from "lucide-react";

type TabKey = "send" | "track" | "deploy";

interface TabContent {
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
}

const tabContent: Record<TabKey, TabContent> = {
  send: {
    title: "Send Emails",
    description:
      "Use our TypeScript SDK to send emails through your own AWS SES infrastructure. Simple API, full type safety, automatic credential handling via OIDC.",
    ctaText: "View SDK Docs",
    ctaLink: "/docs/sdk-reference",
  },
  track: {
    title: "Track Events",
    description:
      "Automatically capture delivery, open, click, bounce, and complaint events. All data stored in DynamoDB in your AWS account for complete data ownership.",
    ctaText: "Learn More",
    ctaLink: "/docs/quickstart",
  },
  deploy: {
    title: "Deploy Infrastructure",
    description:
      "One CLI command deploys production-ready email infrastructure to your AWS account. SES, DynamoDB, Lambda, EventBridge, and IAM roles - all configured automatically.",
    ctaText: "Get Started",
    ctaLink: "/docs/cli-reference",
  },
};

// Icon box component for grid nodes
function IconBox({
  icon: Icon,
  highlighted = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex aspect-square size-11 items-center justify-center rounded-full border-2 bg-background transition-all ${
        highlighted
          ? "border-orange-500 bg-orange-500/5 text-orange-500"
          : "border-border text-muted-foreground"
      }`}
    >
      <Icon className="size-5" />
    </div>
  );
}

// Node group component with ref forwarding
interface NodeGroupProps {
  label: string;
  icons: React.ComponentType<{ className?: string }>[];
  highlighted?: boolean;
  cols?: number;
  nodeRef?: React.RefObject<HTMLDivElement | null>;
}

function NodeGroup({
  label,
  icons,
  highlighted = false,
  cols = 2,
  nodeRef,
}: NodeGroupProps) {
  return (
    <div ref={nodeRef} className="flex flex-col items-center gap-2">
      <div
        className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-4" : "grid-cols-2"}`}
      >
        {icons.map((Icon, i) => (
          <IconBox highlighted={highlighted} icon={Icon} key={i} />
        ))}
      </div>
      <span
        className={`font-medium text-xs ${highlighted ? "text-orange-500" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

// Central hub component with ref
interface CentralHubProps {
  hubRef?: React.RefObject<HTMLDivElement | null>;
}

function CentralHub({ hubRef }: CentralHubProps) {
  return (
    <div ref={hubRef} className="relative">
      <div className="flex h-24 w-20 flex-col items-center justify-center rounded-xl border-2 border-orange-500 bg-gradient-to-b from-orange-500/10 to-orange-500/5">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white">
          <Server className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="h-1 w-6 rounded-full bg-orange-500/40" />
          <div className="h-1 w-6 rounded-full bg-orange-500/40" />
        </div>
      </div>
    </div>
  );
}

// Mobile simplified flow component
function MobileFlow({ activeTab }: { activeTab: TabKey }) {
  const flows = {
    send: [
      { icon: Code2, label: "Your App", highlighted: true },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: Server, label: "Wraps (AWS)", highlighted: true },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: Mail, label: "SES", highlighted: true },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: Users, label: "Recipients", highlighted: false },
    ],
    track: [
      { icon: Mail, label: "SES Events", highlighted: false },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: Server, label: "Wraps (AWS)", highlighted: true },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: Database, label: "DynamoDB", highlighted: true },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: BarChart3, label: "Metrics", highlighted: true },
    ],
    deploy: [
      { icon: Terminal, label: "Wraps CLI", highlighted: true },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: Server, label: "Your AWS", highlighted: true },
      { icon: ArrowRight, label: "", isArrow: true },
      { icon: Mail, label: "SES + Events", highlighted: true },
    ],
  };

  const currentFlow = flows[activeTab];

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {currentFlow.map((item, i) =>
        item.isArrow ? (
          <ArrowRight
            key={i}
            className="h-4 w-4 shrink-0 text-orange-500"
          />
        ) : (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`flex aspect-square size-12 items-center justify-center rounded-full border-2 ${
                item.highlighted
                  ? "border-orange-500 bg-orange-500/5 text-orange-500"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
            </div>
            <span
              className={`text-xs ${item.highlighted ? "text-orange-500" : "text-muted-foreground"}`}
            >
              {item.label}
            </span>
          </div>
        )
      )}
    </div>
  );
}

interface Point {
  x: number;
  y: number;
}

interface NodePositions {
  yourApp: Point;
  cli: Point;
  hub: Point;
  ses: Point;
  recipients: Point;
  eventTypes: Point;
  metrics: Point;
}

// Generate curved path between two points
function createCurvedPath(
  from: Point,
  to: Point,
  curvature: number = 0.5
): string {
  const dx = to.x - from.x;

  // Control points for smooth curve
  const cp1x = from.x + dx * curvature;
  const cp1y = from.y;
  const cp2x = to.x - dx * curvature;
  const cp2y = to.y;

  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

// SVG Connection lines with dynamic positions
function ConnectionLines({
  activeTab,
  positions,
}: {
  activeTab: TabKey;
  positions: NodePositions | null;
}) {
  if (!positions) return null;

  const { yourApp, cli, hub, ses, recipients, eventTypes, metrics } = positions;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 0 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="8"
          refY="4"
          markerUnits="strokeWidth"
        >
          <path
            d="M 0 0 L 8 4 L 0 8 Z"
            fill="hsl(var(--muted-foreground))"
          />
        </marker>
        <marker
          id="arrowhead-orange"
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="8"
          refY="4"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#ff6b00" />
        </marker>
      </defs>

      {/* Send tab connections */}
      {activeTab === "send" && (
        <>
          {/* Your App to Hub */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: yourApp.x + 55, y: yourApp.y },
              { x: hub.x - 55, y: hub.y }
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
          {/* Hub to SES */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: hub.x + 45, y: hub.y },
              { x: ses.x - 90, y: ses.y }
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
          {/* SES to Recipients */}
          <path
            d={`M ${ses.x} ${ses.y + 35} L ${recipients.x} ${recipients.y - 40}`}
            fill="none"
            markerEnd="url(#arrowhead)"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1.5"
          />
        </>
      )}

      {/* Track tab connections */}
      {activeTab === "track" && (
        <>
          {/* SES sends events to Hub */}
          <path
            d={createCurvedPath(
              { x: ses.x - 90, y: ses.y + 10 },
              { x: hub.x + 55, y: hub.y - 10 },
              0.4
            )}
            fill="none"
            markerEnd="url(#arrowhead)"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1.5"
          />
          {/* Hub to Event Types - only render if positions are valid */}
          {eventTypes.x > 0 && (
            <path
              className="animate-dash"
              d={`M ${hub.x} ${hub.y + 55} C ${hub.x - 60} ${hub.y + 120}, ${eventTypes.x} ${eventTypes.y - 80}, ${eventTypes.x} ${eventTypes.y - 35}`}
              fill="none"
              markerEnd="url(#arrowhead-orange)"
              stroke="#ff6b00"
              strokeDasharray="8 6"
              strokeWidth="2"
            />
          )}
          {/* Hub to Metrics & Storage - only render if positions are valid */}
          {metrics.x > 0 && (
            <path
              className="animate-dash"
              d={`M ${hub.x} ${hub.y + 55} C ${hub.x + 60} ${hub.y + 120}, ${metrics.x} ${metrics.y - 80}, ${metrics.x} ${metrics.y - 35}`}
              fill="none"
              markerEnd="url(#arrowhead-orange)"
              stroke="#ff6b00"
              strokeDasharray="8 6"
              strokeWidth="2"
            />
          )}
        </>
      )}

      {/* Deploy tab connections */}
      {activeTab === "deploy" && (
        <>
          {/* CLI to Hub */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: cli.x + 55, y: cli.y },
              { x: hub.x - 55, y: hub.y + 20 },
              0.5
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
          {/* Hub to SES+Events */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: hub.x + 45, y: hub.y - 20 },
              { x: ses.x - 90, y: ses.y },
              0.5
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
          {/* Hub to Recipients */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: hub.x + 45, y: hub.y + 20 },
              { x: recipients.x - 90, y: recipients.y },
              0.5
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

export function ArchitectureSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("send");
  const [positions, setPositions] = useState<NodePositions | null>(null);

  // Refs for all nodes
  const containerRef = useRef<HTMLDivElement>(null);
  const yourAppRef = useRef<HTMLDivElement>(null);
  const cliRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const sesRef = useRef<HTMLDivElement>(null);
  const recipientsRef = useRef<HTMLDivElement>(null);
  const eventTypesRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);

  // Calculate positions relative to container
  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    const getCenter = (ref: React.RefObject<HTMLDivElement | null>): Point => {
      if (!ref.current) return { x: 0, y: 0 };
      const rect = ref.current.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
      };
    };

    setPositions({
      yourApp: getCenter(yourAppRef),
      cli: getCenter(cliRef),
      hub: getCenter(hubRef),
      ses: getCenter(sesRef),
      recipients: getCenter(recipientsRef),
      eventTypes: getCenter(eventTypesRef),
      metrics: getCenter(metricsRef),
    });
  }, []);

  // Update positions on mount, resize, and tab change
  useEffect(() => {
    updatePositions();

    const handleResize = () => {
      requestAnimationFrame(updatePositions);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updatePositions, activeTab]);

  // Small delay to ensure layout is complete
  useEffect(() => {
    const timer = setTimeout(updatePositions, 50);
    return () => clearTimeout(timer);
  }, [activeTab, updatePositions]);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            How Wraps Works
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Deploy email infrastructure to your AWS account with one command.
            Send emails with our SDK. Track everything automatically.
          </p>
        </div>

        {/* Main diagram container */}
        <div className="overflow-hidden rounded-2xl border bg-muted/20">
          {/* Tab bar */}
          <div className="flex justify-center border-b bg-background/50 py-4">
            <div className="inline-flex rounded-full border bg-background p-1">
              {(["send", "track", "deploy"] as const).map((tab) => (
                <button
                  className={`rounded-full px-5 py-2 font-medium text-sm transition-all ${
                    activeTab === tab
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "send" && "Send Email"}
                  {tab === "track" && "Track Events"}
                  {tab === "deploy" && "Deploy"}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile: Simplified vertical flow */}
          <div className="block p-6 md:hidden">
            <MobileFlow activeTab={activeTab} />
          </div>

          {/* Desktop: Full diagram */}
          <div
            ref={containerRef}
            className="relative hidden min-h-[450px] p-8 md:block"
          >
            {/* Connection lines SVG */}
            <ConnectionLines activeTab={activeTab} positions={positions} />

            {/* Node layout */}
            <div className="relative z-10 flex items-start justify-center gap-24 md:gap-32 lg:gap-40">
              {/* Left side */}
              <div className="flex flex-col gap-12">
                {/* Your App / SDK */}
                <NodeGroup
                  nodeRef={yourAppRef}
                  highlighted={activeTab === "send"}
                  icons={[Code2, Terminal, Inbox, Mail]}
                  label="Your App"
                />

                {/* CLI */}
                <NodeGroup
                  nodeRef={cliRef}
                  highlighted={activeTab === "deploy"}
                  icons={[Terminal, Shield]}
                  label="Wraps CLI"
                />
              </div>

              {/* Center - Hub */}
              <div className="flex flex-col items-center pt-16">
                <div className="mb-2 rounded-lg bg-muted/50 px-3 py-1 text-muted-foreground text-xs">
                  Your AWS Account
                </div>
                <CentralHub hubRef={hubRef} />
                <span className="mt-2 font-mono font-semibold text-orange-500 text-sm">
                  wraps
                </span>
              </div>

              {/* Right side */}
              <div className="flex flex-col gap-8">
                {/* AWS Services */}
                <NodeGroup
                  nodeRef={sesRef}
                  highlighted={activeTab === "send" || activeTab === "deploy"}
                  icons={[Mail, Zap, Database]}
                  label="SES + Events"
                  cols={3}
                />

                {/* Recipients */}
                <NodeGroup
                  nodeRef={recipientsRef}
                  highlighted={activeTab === "send"}
                  icons={[Users, Users, Users]}
                  label="Recipients"
                  cols={3}
                />
              </div>
            </div>

            {/* Bottom row - Event types (for track tab) */}
            {activeTab === "track" && (
              <div className="mt-8 flex justify-center gap-6">
                <NodeGroup
                  nodeRef={eventTypesRef}
                  cols={4}
                  highlighted
                  icons={[Eye, MousePointerClick, AlertTriangle, Clock]}
                  label="Event Types"
                />
                <NodeGroup
                  nodeRef={metricsRef}
                  highlighted
                  icons={[BarChart3, Database]}
                  label="Metrics & Storage"
                />
              </div>
            )}
          </div>

          {/* Bottom description bar */}
          <div className="flex flex-col gap-4 border-t bg-foreground px-6 py-5 text-background md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
            <div className="max-w-xl">
              <h3 className="mb-1 font-semibold text-base md:text-lg">
                {tabContent[activeTab].title}
              </h3>
              <p className="text-background/70 text-sm">
                {tabContent[activeTab].description}
              </p>
            </div>
            <Button
              asChild
              className="w-full shrink-0 bg-background text-foreground hover:bg-background/90 md:w-auto"
              size="lg"
            >
              <a href={tabContent[activeTab].ctaLink}>
                {tabContent[activeTab].ctaText}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Legend - hidden on mobile */}
        <div className="mt-6 hidden flex-wrap items-center justify-center gap-6 text-muted-foreground text-sm md:flex">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded border-2 border-orange-500 bg-orange-500/20" />
            <span>Active Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded border-2 border-border" />
            <span>Infrastructure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 border-t-2 border-dashed border-orange-500" />
            <span>Data Path</span>
          </div>
        </div>
      </div>

      {/* CSS for dash animation */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          animation: dash 1s linear infinite;
        }
      `}</style>
    </section>
  );
}
