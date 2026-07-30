import {
  Activity,
  CircleDollarSign,
  Clock,
  Code2,
  Infinity as InfinityIcon,
  Zap,
} from "lucide-react";
import { SectionKicker } from "@/app/landing/components/section-kicker";

const eventTypes = [
  {
    icon: Zap,
    title: "Tracked Events",
    description:
      "Track any action: signups, purchases, page views, button clicks",
    counted: true,
  },
  {
    icon: Activity,
    title: "Email Engagement",
    description: "Opens, clicks, bounces, complaints tracked automatically",
    example: "Automatic via SES EventBridge",
    counted: false,
  },
];

const customEventCode = `await wraps.track('order.completed', {
  contactEmail: 'jane@acme.co',
  properties: { orderId: '123' },
})`;

const benefits = [
  {
    icon: InfinityIcon,
    title: "Unlimited Contacts",
    description:
      "Store as many contacts as you need. We don't charge for database rows.",
  },
  {
    icon: CircleDollarSign,
    title: "Pay for Actions",
    description:
      "Only tracked events count. Email engagement tracking is always free.",
  },
  {
    icon: Clock,
    title: "Flexible Retention",
    description:
      "7 days to 1 year history. Tracked events power segments and automations.",
  },
];

export function DashboardEventsSection() {
  return (
    <section className="relative py-24" id="events">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <SectionKicker>Event-Based Pricing</SectionKicker>
          <h2 className="mb-4 font-heading font-semibold text-3xl tracking-tight md:text-4xl">
            What counts as an event?
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            We only charge for tracked events you explicitly send. Email opens,
            clicks, and delivery events are always free.
          </p>
        </div>

        {/* Event Types Comparison */}
        <div className="mb-16 grid gap-6 md:grid-cols-2">
          {eventTypes.map((type) => {
            const Icon = type.icon;
            return (
              <div
                className={`relative overflow-hidden rounded-2xl border p-6 ${
                  type.counted
                    ? "border-orange-500/40 bg-orange-500/5"
                    : "border-border bg-muted/30"
                }`}
                key={type.title}
              >
                {/* Badge */}
                <div className="absolute top-4 right-4">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
                    {type.counted ? "Counts toward limit" : "Always free"}
                  </span>
                </div>

                <div className="mb-4 flex items-center gap-3">
                  <Icon
                    aria-hidden="true"
                    className={`size-5 ${
                      type.counted ? "text-orange-500" : "text-muted-foreground"
                    }`}
                  />
                  <h3 className="font-semibold text-lg">{type.title}</h3>
                </div>

                <p className="mb-4 text-muted-foreground">{type.description}</p>

                {/* Code example */}
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                    <Code2 aria-hidden="true" className="size-3" />
                    <span>
                      {type.counted ? "Platform SDK" : "How it works"}
                    </span>
                  </div>
                  {type.counted ? (
                    <pre className="overflow-x-auto font-mono text-foreground/90 text-xs leading-relaxed">
                      {customEventCode}
                    </pre>
                  ) : (
                    <code className="font-mono text-foreground/90 text-sm">
                      {type.example}
                    </code>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Benefits Grid */}
        <div className="rounded-2xl border border-border bg-muted/30 p-8">
          <h3 className="mb-6 font-heading font-semibold text-lg tracking-tight">
            Why event-based pricing?
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title}>
                  <Icon
                    aria-hidden="true"
                    className="mb-3 size-5 text-muted-foreground"
                  />
                  <h4 className="mb-1 font-medium">{benefit.title}</h4>
                  <p className="text-muted-foreground text-sm">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison note */}
        <p className="mt-8 text-muted-foreground text-sm">
          Compare: Customer.io charges $150+/mo for 12K contacts. Wraps gives
          you unlimited contacts on every plan—even the free tier.
        </p>
      </div>
    </section>
  );
}
