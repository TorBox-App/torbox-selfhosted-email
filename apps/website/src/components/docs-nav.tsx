"use client";

import {
  BarChart3,
  Blocks,
  Book,
  Cloud,
  FileText,
  Globe,
  Mail,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
          {
            title: "Email",
            href: "/docs/quickstart/email",
            icon: Mail,
          },
          {
            title: "Platform",
            href: "/docs/quickstart/platform",
            icon: Blocks,
          },
          {
            title: "SMS",
            href: "/docs/quickstart/sms",
            icon: MessageSquare,
          },
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
    title: "Reference",
    items: [
      {
        title: "CLI Reference",
        href: "/docs/cli-reference",
        icon: Terminal,
      },
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
    title: "Guides",
    items: [
      {
        title: "Guides",
        href: "/docs/guides",
        icon: Book,
        children: [
          {
            title: "AWS Setup",
            href: "/docs/guides/aws-setup",
            icon: Cloud,
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
        ],
      },
    ],
  },
];

function NavItemComponent({
  item,
  pathname,
  depth = 0,
}: {
  item: NavItem;
  pathname: string;
  depth?: number;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href;
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren && item.children?.some((child) => pathname === child.href);

  return (
    <>
      <a
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive || isChildActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          item.disabled && "pointer-events-none opacity-50",
          depth > 0 && "ml-4 border-l pl-4"
        )}
        href={item.disabled ? undefined : item.href}
      >
        <Icon className="h-4 w-4" />
        {item.title}
        {item.disabled && <span className="ml-auto text-xs">(Soon)</span>}
      </a>
      {hasChildren && (
        <div className="space-y-1">
          {item.children?.map((child) => (
            <NavItemComponent
              depth={depth + 1}
              item={child}
              key={child.href}
              pathname={pathname}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function DocsNav() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav className="w-full">
      {navItems.map((section) => (
        <div className="pb-8" key={section.title}>
          <h4 className="mb-3 px-2 font-semibold text-muted-foreground text-sm uppercase tracking-wider">
            {section.title}
          </h4>
          <div className="space-y-1">
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
