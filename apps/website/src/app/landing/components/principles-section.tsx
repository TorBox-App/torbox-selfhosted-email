import { Cloud, GitPullRequest, ShieldCheck, Users } from "lucide-react";
import { FadeIn } from "./animations";

const principles = [
  {
    icon: GitPullRequest,
    title: "Code You Can Review",
    description:
      "Templates and workflows live in your repo. Review in PRs. Roll back bad deploys. No more 'don't edit while I'm editing.'",
  },
  {
    icon: ShieldCheck,
    title: "Type-Safe Everything",
    description:
      "TypeScript SDK. Typed template variables. Typed workflow definitions. Catch errors before they reach an inbox.",
  },
  {
    icon: Users,
    title: "No More Tickets",
    description:
      "Engineers own the code. Marketers own the content. Both deploy through the same pipeline. Nobody waits on a Jira ticket to change a button color.",
  },
  {
    icon: Cloud,
    title: "Sends Through Your AWS",
    description:
      "Your SES. Your DynamoDB. Your domain reputation. Pay AWS directly. Leave anytime, keep everything.",
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
            distance = (rows - 1 - row + col) / (rows + cols - 2);
          }

          const opacity = Math.max(0, 1 - distance * 1.2);

          if (opacity <= 0.05) {
            return <div className="size-1" key={i} />;
          }

          return (
            <div
              className="size-1 rounded-full bg-orange-500 dark:bg-orange-400"
              key={i}
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
      <DotGrid fadeDirection="to-top-right" position="-bottom-4 -left-4" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Principles Grid */}
        <FadeIn>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {principles.map((principle) => {
              const Icon = principle.icon;
              return (
                <div key={principle.title}>
                  <div className="group relative h-full overflow-hidden rounded-lg border border-black/[0.06] bg-black/[0.03] p-4 pt-12 backdrop-blur-xl transition-all hover:border-orange-500/50 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.04]">
                    {/* Large background icon */}
                    <div className="absolute -right-3 -top-3 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]">
                      <Icon className="size-24 text-orange-500" />
                    </div>

                    {/* Small accent icon */}
                    <div className="absolute left-4 top-4">
                      <Icon className="size-5 text-orange-500" />
                    </div>

                    <h3 className="relative mb-1 font-semibold text-sm text-foreground/70">
                      {principle.title}
                    </h3>
                    <p className="relative text-foreground/70 text-xs leading-relaxed">
                      {principle.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
