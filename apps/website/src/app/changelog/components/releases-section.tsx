"use client";

import {
  Rocket,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type ReleaseType = "major" | "minor" | "patch";

type Release = {
  version: string;
  date: string;
  type: ReleaseType;
  title: string;
  items: string[];
};

const releases: Release[] = [
  {
    version: "0.4.0",
    date: "December 2024",
    type: "minor",
    title: "Workflow Automations",
    items: [
      "Communication automations with visual workflow builder",
      "AI-powered template generation",
      "SMS support via AWS End User Messaging",
      "Toll-free number registration workflow",
    ],
  },
  {
    version: "0.3.0",
    date: "November 2024",
    type: "minor",
    title: "Topics & Segments",
    items: [
      "Topics and subscription management",
      "Segments with property-based filtering",
      "Scheduled broadcasts",
      "Contact import/export",
    ],
  },
  {
    version: "0.2.0",
    date: "October 2024",
    type: "minor",
    title: "Dashboard & Templates",
    items: [
      "Hosted dashboard at app.wraps.dev",
      "Visual email template editor",
      "Email analytics and event tracking",
      "Contact management",
    ],
  },
  {
    version: "0.1.0",
    date: "September 2024",
    type: "major",
    title: "Initial Release",
    items: [
      "One-command AWS SES deployment",
      "Domain verification and DKIM setup",
      "Local console for development",
      "Vercel OIDC authentication",
      "@wraps.dev/email TypeScript SDK",
    ],
  },
];

const typeConfig: Record<ReleaseType, { icon: LucideIcon; color: string }> = {
  major: {
    icon: Rocket,
    color: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  },
  minor: {
    icon: Sparkles,
    color: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  patch: {
    icon: Wrench,
    color: "border-gray-500/30 bg-gray-500/10 text-gray-600 dark:text-gray-400",
  },
};

export function ChangelogReleasesSection() {
  return (
    <section className="py-12 pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute top-0 left-[19px] h-full w-px bg-border" />

          {/* Releases */}
          <div className="space-y-12">
            {releases.map((release, index) => {
              const { icon: Icon, color } = typeConfig[release.type];
              return (
                <div className="relative pl-12" key={release.version}>
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 flex size-10 items-center justify-center rounded-full border-2 bg-background ${color}`}
                  >
                    <Icon className="size-5" />
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
                        {release.items.map((item) => (
                          <li
                            className="flex items-start gap-3 text-sm"
                            key={item}
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
      </div>
    </section>
  );
}
