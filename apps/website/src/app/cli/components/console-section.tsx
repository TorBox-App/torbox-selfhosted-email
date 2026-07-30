import { SectionKicker } from "@/app/landing/components/section-kicker";

export function CliConsoleSection() {
  return (
    <section className="py-16 sm:py-24" id="console">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <SectionKicker>Local console</SectionKicker>
          <p className="text-lg text-muted-foreground">
            Run{" "}
            <code className="rounded bg-muted px-2 py-1 font-mono text-foreground text-sm">
              wraps console
            </code>{" "}
            for a local dashboard.{" "}
            <span className="text-foreground">
              Your data never leaves your machine.
            </span>
          </p>
        </div>

        {/* Console GIF */}
        <div className="group relative mx-auto max-w-4xl">
          {/* Browser window */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
            {/* Simple browser chrome */}
            <div className="flex items-center gap-2 border-border border-b bg-muted/40 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <div className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <div className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              </div>
              <span className="ml-2 font-mono text-muted-foreground text-xs">
                localhost:5555
              </span>
            </div>

            {/* Screenshot */}
            <div className="relative aspect-video overflow-hidden bg-muted/20">
              <video
                autoPlay
                className="size-full object-cover object-top"
                loop
                muted
                playsInline
                preload="none"
                src="/cli/wraps-console.mp4"
              >
                <track
                  kind="descriptions"
                  label="Wraps local console dashboard"
                />
              </video>

              {/* Fade overlay at bottom */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/60 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
