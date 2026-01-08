"use client";

import {
  Blocks,
  LayoutTemplate,
  Lightbulb,
  type LucideIcon,
  MessageSquare,
  Rocket,
  Send,
  Tags,
  Terminal,
  Users,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

type Release = {
  version: string;
  date: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  items: ReactNode[];
};

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-green-600 text-xs dark:text-green-400">
    {children}
  </code>
);

const releases: Release[] = [
  {
    version: "0.10.0",
    date: "January 2026",
    icon: Workflow,
    iconColor:
      "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    title: "Workflow Automations",
    items: [
      "Visual workflow builder with React Flow canvas",
      "AI-powered Flow Designer for natural language automation",
      "Conditional branching and wait-for-event patterns",
      <>
        CLI: <Code>wraps doctor</Code> and <Code>wraps setup</Code> with SSO
        support
      </>,
      <>
        SDK: <Code>@wraps.dev/client</Code> events and workflow trigger
        endpoints
      </>,
    ],
  },
  {
    version: "0.9.0",
    date: "January 2026",
    icon: Send,
    iconColor:
      "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    title: "Broadcasts",
    items: [
      "Scheduled broadcasts with bulk SES sending",
      "Brand kits for consistent email styling",
      "Broadcast analytics and delivery tracking",
    ],
  },
  {
    version: "0.8.0",
    date: "January 2026",
    icon: Tags,
    iconColor:
      "border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400",
    title: "Topics & Double Opt-In",
    items: [
      "Topics for subscription management",
      "Double opt-in confirmation emails",
      "Preference center for subscription management",
      <>
        SDK: <Code>@wraps.dev/client</Code> topicSlugs support
      </>,
    ],
  },
  {
    version: "0.7.0",
    date: "December 2025",
    icon: MessageSquare,
    iconColor:
      "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "SMS Infrastructure",
    items: [
      "SMS support via AWS End User Messaging",
      "Toll-free number provisioning",
      "SMS analytics and delivery tracking",
      <>
        CLI: <Code>wraps sms init</Code>, <Code>status</Code>, and{" "}
        <Code>destroy</Code> commands
      </>,
      <>
        SDK: <Code>@wraps.dev/sms</Code> v0.1.0 for sending SMS via AWS
      </>,
    ],
  },
  {
    version: "0.6.0",
    date: "December 2025",
    icon: Blocks,
    iconColor:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    title: "Deliverability Check",
    items: [
      <>
        CLI: <Code>wraps email check</Code> command
      </>,
      "DNS record validation (SPF, DKIM, DMARC)",
      "Email authentication analysis",
      "Blocklist monitoring across major providers",
      "Actionable remediation suggestions",
    ],
  },
  {
    version: "0.5.0",
    date: "December 2025",
    icon: Blocks,
    iconColor:
      "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400",
    title: "Platform SDK",
    items: [
      <>
        New <Code>@wraps.dev/client</Code> SDK for Platform API
      </>,
      "Type-safe contacts, topics, and segments management",
      "Batch email sending via Platform",
      "API key authentication",
    ],
  },
  {
    version: "0.4.0",
    date: "December 2025",
    icon: Users,
    iconColor:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    title: "Contacts Management",
    items: [
      "Contact creation, editing, and deletion",
      "Activity timeline showing email events per contact",
      "Custom properties with flexible schema",
      "Contact import/export (CSV)",
      "Search and filtering by properties",
      <>
        SDK: <Code>@wraps.dev/client</Code> contacts API
      </>,
    ],
  },
  {
    version: "0.3.0",
    date: "December 2025",
    icon: LayoutTemplate,
    iconColor:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    title: "Template Editor",
    items: [
      "Visual drag-and-drop template editor",
      "Keyboard shortcuts and command menu",
      "Template showcase section",
    ],
  },
  {
    version: "0.2.0",
    date: "November 2025",
    icon: Terminal,
    iconColor:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    title: "Dashboard & Multi-Service CLI",
    items: [
      "Wraps Platform at app.wraps.dev",
      "Email analytics and event tracking",
      "Contact management with activity timeline",
      <>
        CLI: Multi-service architecture (<Code>wraps email</Code>,{" "}
        <Code>wraps sms</Code>)
      </>,
      <>
        CLI: <Code>wraps email domains</Code> and custom tracking domains
      </>,
      <>
        SDK: <Code>@wraps.dev/email</Code> v0.3-0.4 with OIDC federation and
        attachments
      </>,
      "Documentation site with SDK reference",
    ],
  },
  {
    version: "0.1.0",
    date: "November 2025",
    icon: Rocket,
    iconColor:
      "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
    title: "Initial Release",
    items: [
      "One-command AWS SES deployment",
      "Preset configurations (Starter, Production, Enterprise)",
      "Domain verification, DKIM, and MAIL FROM setup",
      "Local console for development",
      "Vercel OIDC authentication",
      <>
        <Code>@wraps.dev/cli</Code> for infrastructure deployment
      </>,
      <>
        <Code>@wraps.dev/email</Code> v0.1-0.2 TypeScript SDK for sending emails
      </>,
    ],
  },
];

export function ChangelogReleasesSection() {
  return (
    <section className="py-12 pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Releases with timeline */}
          <div className="relative">
            {/* Timeline line - contained to releases section */}
            <div className="absolute top-0 bottom-0 left-[24px] w-[1.5px] bg-border" />

            <div className="space-y-12">
              {releases.map((release, index) => {
                const Icon = release.icon;
                return (
                  <div className="relative pl-16" key={release.version}>
                    {/* Timeline dot - outer circle with shadow */}
                    <div className="absolute left-0 flex size-12 items-center justify-center rounded-full bg-background shadow-md">
                      {/* Inner colored circle */}
                      <div
                        className={`flex size-10 items-center justify-center rounded-full border-2 ${release.iconColor}`}
                      >
                        <Icon className="size-5" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="overflow-hidden rounded-xl border bg-background">
                      {/* Header */}
                      <div className="border-b bg-muted/30 px-6 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-foreground px-3 py-1 font-mono font-semibold text-background text-sm">
                            v{release.version}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            {release.date}
                          </span>
                          {index === 0 && (
                            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 font-medium text-green-600 text-xs dark:text-green-400">
                              Latest
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 font-semibold text-lg">
                          {release.title}
                        </h3>
                      </div>

                      {/* Items */}
                      <div className="p-6">
                        <ul className="space-y-2">
                          {release.items.map((item, itemIndex) => (
                            <li
                              className="flex items-start gap-3 text-sm"
                              key={itemIndex}
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Origin card - where it all began */}
          <div className="relative mt-12 pl-16">
            {/* Line connecting from releases to lightbulb center */}
            <div className="absolute -top-12 left-[24px] h-[72px] w-[1.5px] bg-border" />

            {/* Timeline terminator dot - covers end of line */}
            <div className="absolute left-0 flex size-12 items-center justify-center rounded-full bg-background shadow-md">
              <div className="flex size-10 items-center justify-center rounded-full border-2 border-foreground/20 bg-foreground/5 text-foreground/60">
                <Lightbulb className="size-5" />
              </div>
            </div>

            {/* Content */}
            <div className="overflow-hidden rounded-xl border border-dashed bg-muted/20">
              <div className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm">
                    October 30th, 2025
                  </span>
                </div>
                <h3 className="mt-2 font-semibold text-lg">The Idea</h3>
                <p className="mt-2 text-muted-foreground text-sm">
                  What if deploying email infrastructure to AWS was as simple as
                  one command? No vendor lock-in, no markup on AWS pricing, just
                  great developer experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
