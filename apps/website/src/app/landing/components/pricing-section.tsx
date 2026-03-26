import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WrapsMotif } from "@/components/wraps-motif";
import { PRICING_COPY, PRICING_TIERS } from "@/config/pricing";
import { FreeHero } from "./free-hero";
import { PricingCards } from "./pricing-cards";
import { TrackedEventsExplainer } from "./tracked-events-explainer";

const paidTiers = PRICING_TIERS.filter((t) => t.id !== "free");

export function PricingSection() {
  return (
    <section className="py-24" id="pricing">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center animate-fade-in-up">
          <span className="mb-4 inline-block rounded-full border px-3 py-1 font-medium text-xs bg-background text-muted-foreground border-border">
            Pricing
          </span>
          <h2 className="mb-4 font-bold text-3xl tracking-tight font-heading md:text-4xl">
            {PRICING_COPY.headline}
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            {PRICING_COPY.subheadline}
          </p>
        </div>

        {/* Free hero card */}
        <FreeHero />

        {/* Tracked events explainer */}
        <div className="my-16">
          <TrackedEventsExplainer />
        </div>

        {/* Paid tiers sub-header */}
        <div className="mb-8 text-center">
          <h3 className="mb-2 font-bold text-2xl tracking-tight font-heading">
            {PRICING_COPY.paidTiersHeadline}
          </h3>
          <p className="text-muted-foreground">
            {PRICING_COPY.paidTiersSubline}
          </p>
        </div>

        {/* Paid pricing cards (Starter, Growth, Scale) */}
        <PricingCards tiers={paidTiers} />

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

        {/* AWS Cost Note */}
        <div className="relative rounded-xl border bg-muted/30 p-6">
          <WrapsMotif className="absolute top-4 right-4 size-4 text-orange-500/70" />
          <p className="mb-2 font-semibold text-foreground">
            AWS costs are separate
          </p>
          <p className="mb-4 text-muted-foreground text-sm">
            You pay AWS directly for sending at{" "}
            <strong className="text-foreground">$0.10 per 1,000 emails</strong>{" "}
            plus infrastructure (~$2-5/mo). <br />
            Your sending infrastructure stays in your account — leave anytime,
            keep everything.
          </p>
          <Button asChild className="cursor-pointer" variant="outline">
            <Link href="/tools/ses-calculator">Calculate Your Costs</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
