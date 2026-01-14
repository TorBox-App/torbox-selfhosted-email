"use client";

import { ArrowRight, Check, Globe, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Mail,
    name: "Email",
    description: "AWS SES",
    status: "available",
  },
  {
    icon: Globe,
    name: "CDN",
    description: "AWS CloudFront",
    status: "available",
  },
  {
    icon: MessageSquare,
    name: "SMS",
    description: "AWS End User Messaging",
    status: "coming",
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

        {/* Services Timeline */}
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            const isAvailable = service.status === "available";
            const isComing = service.status === "coming";

            return (
              <div
                className={`relative rounded-xl border p-5 transition-colors ${
                  isAvailable
                    ? "border-orange-500 bg-orange-500/5"
                    : "border-border bg-background hover:border-orange-500/50"
                }`}
                key={service.name}
              >
                {/* Status Badge */}
                <div className="absolute right-4 top-4">
                  {isAvailable ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
                      <Check className="size-3" />
                      Available
                    </span>
                  ) : isComing ? (
                    <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-600 dark:text-orange-400">
                      Coming Soon
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                      Planned
                    </span>
                  )}
                </div>

                <div
                  className={`mb-3 flex size-12 items-center justify-center rounded-lg ${
                    isAvailable
                      ? "bg-orange-500/10 text-orange-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-6" />
                </div>
                <h3
                  className={`mb-1 font-semibold text-lg ${
                    isAvailable ? "text-orange-500" : ""
                  }`}
                >
                  {service.name}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <Button
            asChild
            className="cursor-pointer bg-orange-500 hover:bg-orange-600"
          >
            <a href="/sms">
              Join SMS Waitlist
              <ArrowRight className="ml-1 size-4" />
            </a>
          </Button>
          <p className="text-muted-foreground text-xs">
            Be the first to know when SMS launches
          </p>
        </div>
      </div>
    </section>
  );
}
