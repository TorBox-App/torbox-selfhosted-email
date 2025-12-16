"use client";

import {
  AlertTriangle,
  ArrowRight,
  Code2,
  Database,
  Eye,
  Mail,
  MousePointerClick,
  Radio,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

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
      "When recipients open, click, or bounce emails, SES captures these events. Wraps infrastructure routes them through EventBridge and SQS to Lambda, storing everything in DynamoDB.",
    ctaText: "Learn More",
    ctaLink: "/docs/quickstart",
  },
  deploy: {
    title: "Deploy Infrastructure",
    description:
      "One CLI command deploys production-ready email infrastructure to your AWS account. SES, DynamoDB, Lambda, EventBridge, SQS, and IAM roles - all configured automatically.",
    ctaText: "Get Started",
    ctaLink: "/docs/cli-reference",
  },
};

// Icon box component for grid nodes
function IconBox({
  icon: Icon,
  highlighted = false,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex aspect-square size-10 items-center justify-center rounded-full border-2 bg-background transition-all ${
          highlighted
            ? "border-orange-500 bg-orange-500/5 text-orange-500"
            : "border-border text-muted-foreground"
        }`}
      >
        <Icon className="size-4" />
      </div>
      {label && (
        <span
          className={`text-[10px] ${highlighted ? "text-orange-500" : "text-muted-foreground"}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// Simple node component for external entities (Your App, Recipients)
interface SimpleNodeProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
  nodeRef?: React.RefObject<HTMLDivElement | null>;
}

function SimpleNode({
  label,
  icon: Icon,
  highlighted = false,
  nodeRef,
}: SimpleNodeProps) {
  return (
    <div className="flex flex-col items-center gap-2" ref={nodeRef}>
      <div
        className={`flex aspect-square size-14 items-center justify-center rounded-full border-2 bg-background transition-all ${
          highlighted
            ? "border-orange-500 bg-orange-500/5 text-orange-500"
            : "border-border text-muted-foreground"
        }`}
      >
        <Icon className="size-6" />
      </div>
      <span
        className={`font-medium text-xs ${highlighted ? "text-orange-500" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

// AWS Account container with SES and Wraps infrastructure boxes
interface AWSAccountBoxProps {
  activeTab: TabKey;
  sesRef?: React.RefObject<HTMLDivElement | null>;
  wrapsRef?: React.RefObject<HTMLDivElement | null>;
}

function AWSAccountBox({ activeTab, sesRef, wrapsRef }: AWSAccountBoxProps) {
  const sesHighlighted =
    activeTab === "send" || activeTab === "deploy" || activeTab === "track";
  const wrapsHighlighted = activeTab === "track" || activeTab === "deploy";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-lg bg-muted/50 px-3 py-1 text-muted-foreground text-xs">
        Your AWS Account
      </div>
      <div className="flex flex-col gap-4 rounded-xl border-2 border-muted-foreground/30 border-dashed bg-muted/10 p-4">
        {/* SES Box - Top Row */}
        <div className="flex flex-col items-center gap-2" ref={sesRef}>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 transition-all ${
              sesHighlighted
                ? "border-orange-500 bg-orange-500/5 text-orange-500"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            <Mail className="h-6 w-6" />
          </div>
          <span
            className={`font-medium text-xs ${
              sesHighlighted ? "text-orange-500" : "text-muted-foreground"
            }`}
          >
            SES
          </span>
        </div>

        {/* Wraps Infrastructure Box - Bottom Row */}
        <div className="flex flex-col items-center gap-2" ref={wrapsRef}>
          <div
            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all ${
              wrapsHighlighted
                ? "border-orange-500 bg-orange-500/5"
                : "border-border bg-background"
            }`}
          >
            <IconBox highlighted={wrapsHighlighted} icon={Zap} label="EB" />
            <IconBox highlighted={wrapsHighlighted} icon={Radio} label="SQS" />
            <IconBox highlighted={wrapsHighlighted} icon={Code2} label="λ" />
            <IconBox
              highlighted={wrapsHighlighted}
              icon={Database}
              label="DB"
            />
          </div>
          <span
            className={`font-medium text-xs ${
              wrapsHighlighted ? "text-orange-500" : "text-muted-foreground"
            }`}
          >
            Wraps
          </span>
        </div>
      </div>
    </div>
  );
}

// Mobile node component
function MobileNode({
  icon: Icon,
  label,
  highlighted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  highlighted: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex aspect-square size-12 items-center justify-center rounded-full border-2 ${
          highlighted
            ? "border-orange-500 bg-orange-500/5 text-orange-500"
            : "border-border bg-background text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span
        className={`text-xs ${highlighted ? "text-orange-500" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

// Mobile AWS Account box component
function MobileAWSBox({
  showSES = true,
  showWraps = true,
  sesHighlighted = false,
  wrapsHighlighted = false,
}: {
  showSES?: boolean;
  showWraps?: boolean;
  sesHighlighted?: boolean;
  wrapsHighlighted?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] text-muted-foreground">
        Your AWS Account
      </span>
      <div className="flex items-center gap-3 rounded-xl border-2 border-muted-foreground/30 border-dashed bg-muted/10 px-4 py-3">
        {showSES && (
          <MobileNode highlighted={sesHighlighted} icon={Mail} label="SES" />
        )}
        {showWraps && (
          <MobileNode
            highlighted={wrapsHighlighted}
            icon={Database}
            label="Wraps"
          />
        )}
      </div>
    </div>
  );
}

// Mobile simplified flow component
function MobileFlow({ activeTab }: { activeTab: TabKey }) {
  // Shared offset to align external nodes with AWS box content (accounting for "Your AWS Account" label)
  const nodeOffset = "mb-5";
  const arrowOffset = "mb-12";

  if (activeTab === "send") {
    return (
      <div className="flex flex-wrap items-end justify-center gap-3 pb-1">
        <div className={nodeOffset}>
          <MobileNode highlighted icon={Code2} label="Your App" />
        </div>
        <ArrowRight
          className={`h-4 w-4 shrink-0 text-orange-500 ${arrowOffset}`}
        />
        <MobileAWSBox sesHighlighted showWraps={false} />
        <ArrowRight
          className={`h-4 w-4 shrink-0 text-orange-500 ${arrowOffset}`}
        />
        <div className={nodeOffset}>
          <MobileNode highlighted icon={Users} label="Recipients" />
        </div>
      </div>
    );
  }

  if (activeTab === "track") {
    return (
      <div className="flex flex-wrap items-end justify-center gap-3 pb-1">
        <div className={nodeOffset}>
          <MobileNode highlighted icon={Users} label="Recipients" />
        </div>
        <ArrowRight
          className={`h-4 w-4 shrink-0 text-orange-500 ${arrowOffset}`}
        />
        <MobileAWSBox sesHighlighted wrapsHighlighted />
      </div>
    );
  }

  // Deploy tab
  return (
    <div className="flex flex-wrap items-end justify-center gap-3 pb-1">
      <div className={nodeOffset}>
        <MobileNode highlighted icon={Terminal} label="CLI" />
      </div>
      <ArrowRight
        className={`h-4 w-4 shrink-0 text-orange-500 ${arrowOffset}`}
      />
      <MobileAWSBox sesHighlighted wrapsHighlighted />
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
  ses: Point;
  wraps: Point;
  recipients: Point;
}

// Generate curved path between two points
function createCurvedPath(from: Point, to: Point, curvature = 0.5): string {
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

  const { yourApp, cli, ses, wraps, recipients } = positions;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 0 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerHeight="8"
          markerUnits="strokeWidth"
          markerWidth="8"
          orient="auto"
          refX="8"
          refY="4"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="hsl(var(--muted-foreground))" />
        </marker>
        <marker
          id="arrowhead-orange"
          markerHeight="8"
          markerUnits="strokeWidth"
          markerWidth="8"
          orient="auto"
          refX="8"
          refY="4"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#ff6b00" />
        </marker>
      </defs>

      {/* Send tab connections */}
      {activeTab === "send" && (
        <>
          {/* Your App to SES */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: yourApp.x + 35, y: yourApp.y - 12 },
              { x: ses.x - 35, y: ses.y - 12 }
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
          {/* SES to Recipients */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: ses.x + 35, y: ses.y - 12 },
              { x: recipients.x - 35, y: recipients.y - 12 }
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
        </>
      )}

      {/* Track tab connections */}
      {activeTab === "track" && (
        <>
          {/* Recipients to SES (events coming back) */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: recipients.x - 35, y: recipients.y - 12 },
              { x: ses.x + 35, y: ses.y - 12 },
              0.4
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
          {/* SES to Wraps - curve from left side of SES down to EB icon */}
          <path
            className="animate-dash"
            d={`M ${ses.x - 35} ${ses.y - 12} C ${ses.x - 65} ${ses.y - 12}, ${wraps.x - 75} ${ses.y + 20}, ${wraps.x - 75} ${wraps.y - 58}`}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
        </>
      )}

      {/* Deploy tab connections */}
      {activeTab === "deploy" && (
        <>
          {/* CLI to SES */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: cli.x + 35, y: cli.y - 12 },
              { x: ses.x - 35, y: ses.y - 12 },
              0.5
            )}
            fill="none"
            markerEnd="url(#arrowhead-orange)"
            stroke="#ff6b00"
            strokeDasharray="8 6"
            strokeWidth="2"
          />
          {/* CLI to Wraps */}
          <path
            className="animate-dash"
            d={createCurvedPath(
              { x: cli.x + 35, y: cli.y + 12 },
              { x: wraps.x - 120, y: wraps.y - 12 },
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
  const sesRef = useRef<HTMLDivElement>(null);
  const wrapsRef = useRef<HTMLDivElement>(null);
  const recipientsRef = useRef<HTMLDivElement>(null);

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
      ses: getCenter(sesRef),
      wraps: getCenter(wrapsRef),
      recipients: getCenter(recipientsRef),
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
            className="relative hidden min-h-[380px] p-8 md:block"
            ref={containerRef}
          >
            {/* Connection lines SVG */}
            <ConnectionLines activeTab={activeTab} positions={positions} />

            {/* Node layout - horizontal flow */}
            <div className="relative z-10 flex items-center justify-center gap-12 lg:gap-16">
              {/* Left side - Your App / CLI */}
              <div className="flex flex-col gap-6">
                <SimpleNode
                  highlighted={activeTab === "send"}
                  icon={Code2}
                  label="Your App"
                  nodeRef={yourAppRef}
                />
                <SimpleNode
                  highlighted={activeTab === "deploy"}
                  icon={Terminal}
                  label="Wraps CLI"
                  nodeRef={cliRef}
                />
              </div>

              {/* Center - AWS Account with SES and Wraps boxes */}
              <AWSAccountBox
                activeTab={activeTab}
                sesRef={sesRef}
                wrapsRef={wrapsRef}
              />

              {/* Right side - Recipients */}
              <div className="flex flex-col items-center gap-4">
                <SimpleNode
                  highlighted={activeTab === "send" || activeTab === "track"}
                  icon={Users}
                  label="Recipients"
                  nodeRef={recipientsRef}
                />
                {/* Event types shown below recipients for track tab */}
                {activeTab === "track" && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/50 bg-orange-500/10 text-orange-500">
                        <Eye className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/50 bg-orange-500/10 text-orange-500">
                        <MousePointerClick className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/50 bg-orange-500/10 text-orange-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <span className="text-[10px] text-orange-500">
                      opens · clicks · bounces
                    </span>
                  </div>
                )}
              </div>
            </div>
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
            <div className="h-0.5 w-6 border-orange-500 border-t-2 border-dashed" />
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
