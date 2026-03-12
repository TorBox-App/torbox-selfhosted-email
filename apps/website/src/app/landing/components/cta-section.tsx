import { WrapsMotif } from "@/components/wraps-motif";
import { CTAButtons } from "./cta-buttons";

export function CTASection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        {/* Headline - server rendered */}
        <div className="animate-fade-in-up">
          <p className="mb-6 text-2xl font-semibold tracking-tight font-heading sm:text-3xl">
            Your infrastructure. Your data.{" "}
            <span className="text-orange-500">Your AWS bill.</span>
          </p>

          <p className="mb-8 text-muted-foreground">
            Deploy in one command. Cancel anytime — everything keeps running.
          </p>
        </div>

        {/* Buttons - client component for tracking */}
        <div className="animate-fade-in-up animation-delay-100">
          <CTAButtons />

          {/* Trust signals - static */}
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
            <span className="inline-flex items-center gap-1.5">
              <WrapsMotif className="size-2.5 text-orange-500/70" />
              No credit card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <WrapsMotif className="size-2.5 text-orange-500/70" />
              Infrastructure stays if you cancel
            </span>
            <span className="inline-flex items-center gap-1.5">
              <WrapsMotif className="size-2.5 text-orange-500/70" />
              Open source
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
