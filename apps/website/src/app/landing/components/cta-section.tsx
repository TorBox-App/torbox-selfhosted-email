import { Code, CreditCard, Server } from "lucide-react";
import { CTAButtons } from "./cta-buttons";
import { SectionKicker } from "./section-kicker";

export function CTASection() {
  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionKicker>Get started</SectionKicker>
        <p className="mb-6 max-w-[18ch] font-heading font-semibold text-[30px] text-foreground leading-[1.08] tracking-[-0.022em] md:text-[40px]">
          Your infrastructure. Your data.{" "}
          <span className="text-orange-500">Your AWS bill.</span>
        </p>

        <p className="mb-8 max-w-[52ch] text-muted-foreground">
          Deploy in one command. Cancel anytime.
        </p>

        <CTAButtons />

        {/* Trust signals */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground text-sm">
          <span className="inline-flex items-center gap-1.5">
            <CreditCard className="size-3.5" />
            No credit card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Server className="size-3.5" />
            Infrastructure stays if you cancel
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Code className="size-3.5" />
            Open source
          </span>
        </div>
      </div>
    </section>
  );
}
