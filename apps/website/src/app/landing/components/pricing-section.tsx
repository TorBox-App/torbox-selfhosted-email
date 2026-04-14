import { Button } from "@wraps/ui/components/ui/button";
import Link from "next/link";
import { PRICING_COPY, PRICING_TIERS } from "@/config/pricing";
import { PricingCards } from "./pricing-cards";
import { TrackedEventsExplainer } from "./tracked-events-explainer";

export function PricingSection() {
  return (
    <section className="py-24" id="pricing">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-bold text-3xl tracking-tight font-heading md:text-4xl">
            {PRICING_COPY.headline}
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            {PRICING_COPY.subheadline}
          </p>
        </div>

        {/* All pricing cards (Free, Starter, Growth) */}
        <PricingCards tiers={PRICING_TIERS.filter((t) => t.id !== "scale")} />

        {/* Enterprise note */}
        <p className="mb-8 text-center text-muted-foreground text-sm">
          {PRICING_COPY.enterpriseNote.split("Contact us")[0]}
          <a
            className="text-primary hover:underline"
            href="mailto:support@wraps.dev"
          >
            Contact us for Enterprise
          </a>
        </p>

        {/* Tracked events explainer */}
        <div className="mb-8">
          <TrackedEventsExplainer />
        </div>

        {/* AWS Cost Note */}
        <div className="relative rounded-xl border bg-muted/30 p-6">
          <p className="mb-2 font-semibold text-foreground">
            AWS costs are separate
          </p>
          <p className="mb-4 text-muted-foreground text-sm">
            You pay AWS directly for sending at{" "}
            <strong className="text-foreground">$0.10 per 1,000 emails</strong>{" "}
            plus infrastructure (~$2-5/mo). The infrastructure lives in your
            account, so you can leave anytime and keep everything.
          </p>
          <Button asChild className="cursor-pointer" variant="outline">
            <Link href="/tools/ses-calculator">Calculate Your Costs</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
