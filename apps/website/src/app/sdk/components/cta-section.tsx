import { Button } from "@wraps/ui/components/ui/button";
import Link from "next/link";

export function SdkCtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl bg-foreground px-8 py-16 text-background">
          <div className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] text-background/60 uppercase tracking-[0.18em]">
            <span className="size-1.5 rounded-full bg-orange-500" />
            <span>npm install @wraps.dev/email</span>
          </div>

          <h2 className="mb-4 font-heading font-semibold text-3xl tracking-tight md:text-4xl">
            Define. Automate. Trigger.
          </h2>
          <p className="mb-8 max-w-xl text-background/70">
            Templates as React components. Workflows as TypeScript. Events from
            your codebase. All running on your AWS.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="bg-orange-500 text-white hover:bg-orange-600"
              size="lg"
            >
              <Link href="/docs/quickstart/email">Get Started</Link>
            </Button>
            <Button
              asChild
              className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
              size="lg"
              variant="outline"
            >
              <Link href="/docs/sdk-reference">SDK Reference</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
