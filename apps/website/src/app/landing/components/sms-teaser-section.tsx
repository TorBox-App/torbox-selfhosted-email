"use client";

import { ArrowRight, Check, Globe, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Mail,
    name: "Email",
    tagline: "Transactional & Marketing",
    aws: "AWS SES",
    price: "$0.10 / 1k emails",
    features: ["Open & click tracking", "Bounce handling", "DKIM signing"],
    status: "available",
    href: "/docs/quickstart/email",
    cta: "Get Started",
  },
  {
    icon: Globe,
    name: "CDN",
    tagline: "Global Asset Delivery",
    aws: "AWS CloudFront",
    price: "$0.085 / GB",
    features: ["Edge caching", "Custom domains", "SSL certificates"],
    status: "available",
    href: "/docs/quickstart/cdn",
    cta: "Get Started",
  },
  {
    icon: MessageSquare,
    name: "SMS",
    tagline: "Text Notifications",
    aws: "AWS End User Messaging",
    price: "Pay per message",
    features: ["Two-way messaging", "Delivery receipts", "Number management"],
    status: "coming",
    href: "/sms",
    cta: "Join Waitlist",
  },
];

export function SmsTeaserSection() {
  return (
    <section className="border-y py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="mb-2 font-medium text-orange-500 text-sm">
            Platform Vision
          </p>
          <h2 className="mb-3 font-bold text-2xl tracking-tight sm:text-3xl">
            Start with Email. Expand When Ready.
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Wraps is building infrastructure wrappers for the AWS services
            developers actually use. Same model every time: one CLI command,
            TypeScript SDK, dashboard, you own everything.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid gap-6 sm:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            const isAvailable = service.status === "available";

            return (
              <div
                className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all ${
                  isAvailable
                    ? "border-zinc-200 bg-white hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5 dark:border-zinc-800 dark:bg-zinc-900"
                    : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30"
                }`}
                key={service.name}
              >
                {/* Large background icon */}
                <div
                  className={`pointer-events-none absolute -right-8 -top-8 transition-opacity ${
                    isAvailable
                      ? "opacity-[0.06] group-hover:opacity-[0.1]"
                      : "opacity-[0.03]"
                  }`}
                >
                  <Icon
                    className={`size-40 ${
                      isAvailable ? "text-orange-500" : "text-foreground"
                    }`}
                  />
                </div>

                {/* Header */}
                <div className="relative border-b border-zinc-100 p-5 pb-4 dark:border-zinc-800">
                  <div className="mb-3 flex items-start justify-between">
                    <div
                      className={`flex size-11 items-center justify-center rounded-xl ${
                        isAvailable
                          ? "bg-orange-500 text-white"
                          : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    {isAvailable ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-medium text-green-700 dark:text-green-400">
                        <Check className="size-2.5" />
                        Available
                      </span>
                    ) : (
                      <span className="rounded-full bg-orange-500/10 px-2 py-1 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <h3
                    className={`font-bold text-2xl ${
                      isAvailable ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {service.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {service.tagline}
                  </p>
                </div>

                {/* Body */}
                <div className="relative flex flex-1 flex-col p-5">
                  {/* AWS Badge */}
                  <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {service.aws}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span
                      className={`font-semibold text-lg ${
                        isAvailable ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {service.price}
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="mb-6 flex-1 space-y-2">
                    {service.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check
                          className={`size-3.5 ${
                            isAvailable ? "text-orange-500" : "text-zinc-400"
                          }`}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isAvailable ? (
                    <Button
                      asChild
                      className="w-full bg-orange-500 hover:bg-orange-600"
                    >
                      <a href={service.href}>
                        {service.cta}
                        <ArrowRight className="ml-1.5 size-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <a href={service.href}>
                        {service.cta}
                        <ArrowRight className="ml-1.5 size-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
