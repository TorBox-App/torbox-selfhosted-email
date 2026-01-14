"use client";

import { CreditCard, Key, Shield } from "lucide-react";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const principles = [
  {
    icon: GitHubIcon,
    title: "Open Source",
    description: "AGPLv3 licensed. Audit every line we deploy.",
  },
  {
    icon: Shield,
    title: "Zero Credentials",
    description: "Your keys never leave your machine. Ever.",
  },
  {
    icon: Key,
    title: "You Own It",
    description: "Deploys to your AWS account. No vendor lock-in.",
  },
  {
    icon: CreditCard,
    title: "AWS Pricing",
    description: "Pay AWS directly. Zero markup, zero fees.",
  },
];

function DotGrid({
  position,
  fadeDirection,
}: {
  position: string;
  fadeDirection: "to-bottom-left" | "to-top-right";
}) {
  const rows = 8;
  const cols = 12;

  return (
    <div className={`absolute ${position}`}>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;

          // Calculate opacity based on distance from corner
          let distance: number;
          if (fadeDirection === "to-bottom-left") {
            // Top-right corner: fade as we go down-left
            distance = (row + (cols - 1 - col)) / (rows + cols - 2);
          } else {
            // Bottom-left corner: fade as we go up-right
            distance = ((rows - 1 - row) + col) / (rows + cols - 2);
          }

          const opacity = Math.max(0, 1 - distance * 1.2);

          if (opacity <= 0.05) return <div key={i} className="size-1" />;

          return (
            <div
              key={i}
              className="size-1 rounded-full bg-orange-500 dark:bg-orange-400"
              style={{ opacity: opacity * 0.5 }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PrinciplesSection() {
  return (
    <section className="relative overflow-hidden pt-6 pb-16 sm:pt-8 sm:pb-20">
      {/* Bottom-left Dot Grid */}
      <DotGrid position="-bottom-4 -left-4" fadeDirection="to-top-right" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Principles Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <div
                className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 pt-12 transition-all hover:border-orange-500/50 dark:border-zinc-800 dark:bg-zinc-900"
                key={principle.title}
              >
                {/* Large background icon */}
                <div className="absolute -right-3 -top-3 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]">
                  <Icon className="size-24 text-orange-500" />
                </div>

                {/* Small accent icon */}
                <div className="absolute left-4 top-4">
                  <Icon className="size-5 text-orange-500" />
                </div>

                <h3 className="relative mb-1 font-semibold text-sm text-foreground">
                  {principle.title}
                </h3>
                <p className="relative text-muted-foreground text-xs leading-relaxed">
                  {principle.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
