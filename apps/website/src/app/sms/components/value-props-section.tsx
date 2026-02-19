import { Clock, DollarSign, Server } from "lucide-react";
import { SectionWrapper } from "@/app/landing/components/section-card";

const valueProps = [
  {
    icon: Clock,
    title: "Toll-Free First",
    description:
      "Instant number provisioning ($2/mo) with 15-day registration. Skip the months-long 10DLC nightmare and start sending in days, not weeks.",
    highlight: "15 days vs months",
  },
  {
    icon: Server,
    title: "Self-Hosted Infrastructure",
    description:
      "Deploy to your AWS account. You own your phone numbers, your data, and your infrastructure. No vendor lock-in, full data residency control.",
    highlight: "Your AWS account",
  },
  {
    icon: DollarSign,
    title: "AWS Pricing",
    description:
      "Pay AWS directly at $0.00849/segment. No platform markups, no surprise fees. Just transparent cloud pricing you can actually understand.",
    highlight: "$0.00849/segment",
  },
];

export function SmsValuePropsSection() {
  return (
    <SectionWrapper
      badge="Why Wraps SMS?"
      description="The same BYOC model that makes our email product compelling, now for SMS."
      id="why-wraps"
      title="SMS without the headaches"
    >
      <div className="grid gap-8 md:grid-cols-3">
        {valueProps.map((prop) => (
          <div
            className="rounded-xl border bg-background p-6 transition-all hover:border-orange-500/30 hover:shadow-lg"
            key={prop.title}
          >
            <div className="mb-4 flex size-12 items-center justify-center rounded-full border-2 border-orange-500/30 bg-orange-500/10">
              <prop.icon className="size-6 text-orange-500" />
            </div>
            <h3 className="mb-2 font-semibold text-lg">{prop.title}</h3>
            <p className="mb-4 text-muted-foreground text-sm">
              {prop.description}
            </p>
            <span className="inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 font-medium text-orange-600 text-xs dark:text-orange-400">
              {prop.highlight}
            </span>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
