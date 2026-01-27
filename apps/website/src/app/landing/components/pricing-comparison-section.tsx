import { ArrowRight, Check, Mail, Send, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ComparisonScenario = {
  id: string;
  icon: typeof Mail;
  useCase: string;
  description: string;
  competitor: {
    name: string;
    metric: string;
    price: string;
  };
  wraps: {
    plan: string;
    trackedEvents: string;
    emailVolume: string;
    price: string;
    breakdown: string;
  };
  savings: string;
  insight: string;
};

const scenarios: ComparisonScenario[] = [
  {
    id: "transactional",
    icon: Send,
    useCase: "Transactional Emails",
    description: "Password resets, receipts, notifications",
    competitor: {
      name: "Resend",
      metric: "50K emails",
      price: "$20/mo",
    },
    wraps: {
      plan: "Free",
      trackedEvents: "0",
      emailVolume: "50K emails",
      price: "$5/mo",
      breakdown: "$0 platform + ~$5 AWS",
    },
    savings: "75% less",
    insight: "SDK sends don't consume tracked events",
  },
  {
    id: "marketing",
    icon: Mail,
    useCase: "Marketing Emails",
    description: "Newsletters, broadcasts, campaigns",
    competitor: {
      name: "Mailchimp",
      metric: "10K contacts",
      price: "$100/mo",
    },
    wraps: {
      plan: "Starter",
      trackedEvents: "0",
      emailVolume: "50K emails",
      price: "$24/mo",
      breakdown: "$19 platform + ~$5 AWS",
    },
    savings: "76% less",
    insight: "Broadcasts don't consume tracked events",
  },
  {
    id: "automations",
    icon: Workflow,
    useCase: "Behavioral Automations",
    description: "Trigger workflows on user actions",
    competitor: {
      name: "Knock",
      metric: "50K messages",
      price: "$250/mo",
    },
    wraps: {
      plan: "Growth",
      trackedEvents: "250K",
      emailVolume: "50K emails",
      price: "$84/mo",
      breakdown: "$79 platform + ~$5 AWS",
    },
    savings: "66% less",
    insight: "250K tracked events included in Growth",
  },
];

function ComparisonCard({ scenario }: { scenario: ComparisonScenario }) {
  const Icon = scenario.icon;

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
            <Icon className="size-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-semibold">{scenario.useCase}</h3>
            <p className="text-muted-foreground text-sm">
              {scenario.description}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-2 divide-x">
        {/* Competitor */}
        <div className="p-5">
          <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {scenario.competitor.name}
          </p>
          <p className="mb-1 text-muted-foreground text-sm">
            {scenario.competitor.metric}
          </p>
          <p className="font-bold text-2xl">{scenario.competitor.price}</p>
        </div>

        {/* Wraps */}
        <div className="bg-orange-500/5 p-5">
          <p className="mb-3 font-medium text-orange-600 text-xs uppercase tracking-wide dark:text-orange-400">
            Wraps {scenario.wraps.plan}
          </p>
          <div className="mb-1 space-y-0.5 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {scenario.wraps.trackedEvents}
              </span>{" "}
              tracked events
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {scenario.wraps.emailVolume}
              </span>{" "}
              sent
            </p>
          </div>
          <p className="font-bold text-2xl text-orange-600 dark:text-orange-400">
            {scenario.wraps.price}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {scenario.wraps.breakdown}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-2">
          <Check className="size-4 text-green-500" />
          <p className="text-muted-foreground text-sm">{scenario.insight}</p>
        </div>
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
          {scenario.savings}
        </Badge>
      </div>
    </div>
  );
}

export function PricingComparisonSection() {
  return (
    <section className="py-20" id="comparison">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header - server rendered */}
        <div className="mx-auto mb-12 max-w-3xl text-center animate-fade-in-up">
          <Badge className="mb-4 bg-orange-500/10 text-orange-600 dark:text-orange-400">
            Pricing Comparison
          </Badge>
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            Same Capabilities.{" "}
            <span className="text-orange-500">Fraction of the Cost.</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            You pay Wraps for the platform. You pay AWS directly for sending.
            Tracked events are only needed for behavioral automations.
          </p>
        </div>

        {/* Comparison Cards - server rendered */}
        <div className="animate-fade-in-up animation-delay-100">
          <div className="grid gap-6 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <ComparisonCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </div>

        {/* CTA - server rendered */}
        <div className="mt-12 text-center animate-fade-in-up animation-delay-200">
          <Button asChild size="lg" variant="outline">
            <a href="/calculator">
              Calculate Your Exact Costs
              <ArrowRight className="ml-2 size-4" />
            </a>
          </Button>
          <p className="mt-3 text-muted-foreground text-sm">
            Enter your volume and see a detailed breakdown
          </p>
        </div>
      </div>
    </section>
  );
}
