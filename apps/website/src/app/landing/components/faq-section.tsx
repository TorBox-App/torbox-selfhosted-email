import { FaqAccordion } from "./faq-accordion";

export function FaqSection() {
  return (
    <section className="py-20" id="faq">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Simple heading - server rendered */}
        <div className="mb-8 text-center animate-fade-in-up">
          <p className="text-lg text-muted-foreground">
            Questions?{" "}
            <span className="text-foreground">We've got answers.</span>
          </p>
        </div>

        {/* Interactive accordion - client component */}
        <div className="animate-fade-in-up animation-delay-100">
          <FaqAccordion />
        </div>

        {/* Simple contact line - server rendered */}
        <div className="mt-8 text-center animate-fade-in-up animation-delay-200">
          <p className="text-muted-foreground text-sm">
            Still have questions?{" "}
            <a
              className="text-orange-500 underline-offset-4 hover:underline"
              href="mailto:support@wraps.dev"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
