"use client";

export function CliConsoleSection() {
  return (
    <section className="py-16 sm:py-24" id="console">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Inline text - flows naturally */}
        <p className="mb-8 text-center text-lg text-muted-foreground">
          Run <code className="rounded bg-muted px-2 py-1 font-mono text-green-500 text-sm">wraps console</code> for a local dashboard.{" "}
          <span className="text-foreground">Your data never leaves your machine.</span>
        </p>

        {/* Console GIF */}
        <div className="group relative mx-auto max-w-4xl">
          {/* Subtle glow on hover */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-green-500/10 via-transparent to-green-500/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

          {/* Browser window */}
          <div className="relative overflow-hidden rounded-2xl border shadow-2xl">
            {/* Simple browser chrome */}
            <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
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
              <img
                alt="Wraps local console dashboard"
                className="size-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.01]"
                decoding="async"
                loading="lazy"
                src="/cli/wraps-console.gif"
              />

              {/* Fade overlay at bottom */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/60 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
