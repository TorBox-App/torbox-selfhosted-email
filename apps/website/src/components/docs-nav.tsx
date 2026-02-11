"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Blocks,
  Book,
  Box,
  ChevronRight,
  Cloud,
  Code2,
  FileCode2,
  FileText,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Mail,
  MessageSquare,
  Rocket,
  Server,
  Settings,
  ShieldCheck,
  Sliders,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  children?: NavItem[];
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navItems: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Introduction",
        href: "/docs",
        icon: FileText,
      },
      {
        title: "Quickstart",
        href: "/docs/quickstart",
        icon: Rocket,
        children: [
          { title: "Email", href: "/docs/quickstart/email" },
          { title: "Inbound Email", href: "/docs/quickstart/email/inbound" },
          { title: "Next.js", href: "/docs/quickstart/email/nextjs" },
          { title: "Express", href: "/docs/quickstart/email/express" },
          { title: "Remix", href: "/docs/quickstart/email/remix" },
          { title: "CDN", href: "/docs/quickstart/cdn" },
          { title: "SMS", href: "/docs/quickstart/sms" },
          { title: "Platform", href: "/docs/quickstart/platform" },
        ],
      },
      {
        title: "Telemetry",
        href: "/docs/telemetry",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "CLI Reference",
    items: [
      {
        title: "Overview",
        href: "/docs/cli-reference",
        icon: Terminal,
      },
      {
        title: "Email Commands",
        href: "/docs/cli-reference/email",
        icon: Mail,
      },
      {
        title: "CDN Commands",
        href: "/docs/cli-reference/cdn",
        icon: HardDrive,
      },
      {
        title: "SMS Commands",
        href: "/docs/cli-reference/sms",
        icon: MessageSquare,
      },
      {
        title: "Auth Commands",
        href: "/docs/cli-reference/auth",
        icon: KeyRound,
      },
      {
        title: "AWS Commands",
        href: "/docs/cli-reference/aws",
        icon: Cloud,
      },
      {
        title: "Platform Commands",
        href: "/docs/cli-reference/platform",
        icon: Blocks,
      },
    ],
  },
  {
    title: "SDK Reference",
    items: [
      {
        title: "Platform SDK",
        href: "/docs/client-sdk-reference",
        icon: Blocks,
      },
      {
        title: "Email SDK",
        href: "/docs/sdk-reference",
        icon: Mail,
      },
      {
        title: "SMS SDK",
        href: "/docs/sms-sdk-reference",
        icon: MessageSquare,
      },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      {
        title: "What Gets Deployed: Email",
        href: "/docs/infrastructure/email",
        icon: Server,
      },
      {
        title: "What Gets Deployed: SMS",
        href: "/docs/infrastructure/sms",
        icon: Server,
      },
      {
        title: "What Gets Deployed: CDN",
        href: "/docs/infrastructure/cdn",
        icon: Server,
      },
      {
        title: "EventBridge Events",
        href: "/docs/infrastructure/events",
        icon: Zap,
      },
      {
        title: "CDK Construct",
        href: "/docs/cdk-reference",
        icon: Layers,
      },
      {
        title: "Pulumi Component",
        href: "/docs/pulumi-reference",
        icon: Box,
      },
    ],
  },
  {
    title: "Reference",
    items: [
      {
        title: "Error Codes",
        href: "/docs/reference/errors",
        icon: AlertTriangle,
      },
      {
        title: "Environment Variables",
        href: "/docs/reference/environment-variables",
        icon: Settings,
      },
    ],
  },
  {
    title: "Guides",
    items: [
      {
        title: "AWS Setup",
        href: "/docs/guides/aws-setup",
        icon: Cloud,
        children: [
          { title: "Quick Start", href: "/docs/guides/aws-setup/quick" },
          { title: "Full Setup", href: "/docs/guides/aws-setup/full" },
          {
            title: "IAM Permissions",
            href: "/docs/guides/aws-setup/permissions",
          },
          {
            title: "Troubleshooting",
            href: "/docs/guides/aws-setup/troubleshooting",
          },
        ],
      },
      {
        title: "Production Access",
        href: "/docs/guides/production-access",
        icon: ShieldCheck,
      },
      {
        title: "Domain Verification",
        href: "/docs/guides/domain-verification",
        icon: Globe,
      },
      {
        title: "Configuration Presets",
        href: "/docs/guides/configuration-presets",
        icon: Sliders,
      },
      {
        title: "Templates as Code",
        href: "/docs/guides/templates",
        icon: FileCode2,
      },
      {
        title: "Building Workflows",
        href: "/docs/guides/workflows",
        icon: Workflow,
      },
      {
        title: "Webhooks",
        href: "/docs/guides/webhooks",
        icon: Zap,
      },
      {
        title: "Vercel Setup",
        href: "/docs/guides/vercel-setup",
        icon: Rocket,
      },
      {
        title: "Migration Guide",
        href: "/docs/guides/migration",
        icon: ArrowRightLeft,
      },
      {
        title: "All Guides",
        href: "/docs/guides",
        icon: Book,
      },
    ],
  },
];

function NavItemComponent({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href;
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren && item.children?.some((child) => pathname === child.href);

  // Expand if this item or any child is active
  const [isExpanded, setIsExpanded] = useState(isActive || isChildActive);

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      <a
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : isChildActive
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          item.disabled && "pointer-events-none opacity-50"
        )}
        href={item.disabled ? undefined : item.href}
        onClick={hasChildren ? handleClick : undefined}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="flex-1">{item.title}</span>
        {hasChildren && (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        )}
        {item.disabled && (
          <span className="text-muted-foreground text-xs">(Soon)</span>
        )}
      </a>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1 ml-4 space-y-0.5 border-border border-l pl-3">
          {item.children?.map((child) => {
            const childIsActive = pathname === child.href;
            return (
              <a
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors",
                  childIsActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                href={child.href}
                key={child.href}
              >
                {child.title}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full space-y-6">
      {navItems.map((section) => (
        <div key={section.title}>
          <h4 className="mb-2 px-2 font-medium text-foreground text-xs uppercase tracking-wide">
            {section.title}
          </h4>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavItemComponent
                item={item}
                key={item.href}
                pathname={pathname}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
