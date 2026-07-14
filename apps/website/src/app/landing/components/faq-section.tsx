import { FaqAccordion } from "./faq-accordion";
import { SectionKicker } from "./section-kicker";

export function FaqSection() {
  return (
    <section className="py-20 md:py-24" id="faq">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header - server rendered */}
        <SectionKicker>FAQ</SectionKicker>
        <h2 className="mb-10 max-w-[24ch] font-heading font-semibold text-[30px] text-foreground leading-[1.08] tracking-[-0.022em] md:text-[40px]">
          Questions? We&apos;ve got answers.
        </h2>

        {/* Interactive accordion - client component */}
        <div className="max-w-3xl">
          <FaqAccordion />
        </div>

        {/* Simple contact line - server rendered */}
        <p className="mt-8 text-muted-foreground text-sm">
          Still have questions?{" "}
          <a
            className="text-orange-500 underline-offset-4 hover:underline"
            href="mailto:support@wraps.dev"
          >
            Contact support
          </a>
        </p>
      </div>
    </section>
  );
}
