import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING_COPY, PRICING_TIERS } from "@/config/pricing";

const freeTier = PRICING_TIERS[0];

export function FreeHero() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="group relative overflow-hidden rounded-2xl border-2 border-orange-500 bg-background p-8 transition-shadow hover:shadow-lg hover:shadow-orange-500/10">
        <span className="mb-4 inline-block rounded-full bg-orange-500/10 px-3 py-1 font-semibold text-orange-600 text-xs dark:text-orange-400">
          Free Forever
        </span>
        <h3 className="mb-2 font-bold text-2xl tracking-tight">
          {PRICING_COPY.freeHeroHeadline}
        </h3>
        <p className="mb-6 text-muted-foreground">
          {PRICING_COPY.freeHeroSubline}
        </p>

        <div className="mb-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {freeTier.features.map((feature) => (
            <div className="flex items-start gap-2" key={feature}>
              <Check className="mt-0.5 size-3 shrink-0 text-orange-500/70" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        <Button
          asChild
          className="relative z-10 cursor-pointer bg-orange-500 hover:bg-orange-600 after:absolute after:-inset-[2000px] after:z-[-1]"
          size="lg"
        >
          <a href={freeTier.ctaLink}>{freeTier.cta}</a>
        </Button>
      </div>
    </div>
  );
}
