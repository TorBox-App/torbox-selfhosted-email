import { DotPattern } from "@wraps/ui/components/dot-pattern";
import { HeroAnimatedCTA } from "@/app/landing/components/hero-cta";
import { ToolCallTrace } from "./tool-call-trace";

export function AgentsHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-28">
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          {/* Left column — mono-forward copy */}
          <div>
            {/* Mono tag, no marketing badge */}
            <div className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              <span className="size-1.5 rounded-full bg-orange-500" />
              <span>wraps · for agents</span>
            </div>

            <h1 className="mb-6 text-pretty font-heading font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
              Email infrastructure{" "}
              <span className="text-orange-500">your agent owns.</span>
            </h1>

            {/* Mono anchor: the tool signature IS the marketing */}
            <pre className="mb-6 overflow-x-auto rounded-lg border border-border bg-card/60 px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground/90">
              <span className="text-muted-foreground">tool</span>{" "}
              <span className="text-orange-500">wraps.emails.send</span>
              {"("}
              {"\n  "}from: <span className="text-foreground/60">string</span>,
              {"\n  "}to: <span className="text-foreground/60">string</span>,
              {"\n  "}subject:{" "}
              <span className="text-foreground/60">string</span>,{"\n  "}html:{" "}
              <span className="text-foreground/60">string</span>,{"\n"}
              {"): { messageId: string }"}
            </pre>

            <p className="mb-6 max-w-md text-muted-foreground">
              One tool. One AWS account — yours. The agent calls it; the
              reputation, logs, and bill live where they should.
            </p>

            <HeroAnimatedCTA />
          </div>

          {/* Right column — animated tool-call trace */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-orange-500/10 opacity-60 blur-2xl" />
            <div className="relative">
              <ToolCallTrace />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
