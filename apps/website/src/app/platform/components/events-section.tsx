"use client";

import {
  Activity,
  CircleDollarSign,
  Clock,
  Code2,
  Infinity as InfinityIcon,
  Zap,
} from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

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
      "30 days to 1 year history. Tracked events power segments and automations.",
  },
];

export function DashboardEventsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-24" id="events" ref={ref}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-2 font-medium text-orange-500 text-sm">
            Event-Based Pricing
          </p>
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            What counts as an event?
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            We only charge for tracked events you explicitly send. Email opens,
            clicks, and delivery events are always free.
          </p>
        </motion.div>

        {/* Event Types Comparison */}
        <div className="mb-16 grid gap-6 md:grid-cols-2">
          {eventTypes.map((type, index) => {
            const Icon = type.icon;
            return (
              <motion.div
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                }
                className={`relative overflow-hidden rounded-2xl border-2 p-6 ${
                  type.counted
                    ? "border-orange-500 bg-orange-500/5"
                    : "border-green-500 bg-green-500/5"
                }`}
                initial={{ opacity: 0, y: 20 }}
                key={type.title}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                {/* Badge */}
                <div className="absolute top-4 right-4">
                  <span
                    className={`rounded-full px-2 py-1 font-medium text-xs ${
                      type.counted
                        ? "bg-orange-500 text-white"
                        : "bg-green-500 text-white"
                    }`}
                  >
                    {type.counted ? "Counts toward limit" : "Always free"}
                  </span>
                </div>

                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full ${
                      type.counted ? "bg-orange-500/10" : "bg-green-500/10"
                    }`}
                  >
                    <Icon
                      className={`size-5 ${
                        type.counted ? "text-orange-500" : "text-green-500"
                      }`}
                    />
                  </div>
                  <h3 className="font-semibold text-lg">{type.title}</h3>
                </div>

                <p className="mb-4 text-muted-foreground">{type.description}</p>

                {/* Code example */}
                <div className="rounded-lg bg-zinc-900 p-3">
                  <div className="flex items-center gap-2 text-zinc-500 text-xs mb-2">
                    <Code2 className="size-3" />
                    <span>
                      {type.counted ? "Platform SDK" : "How it works"}
                    </span>
                  </div>
                  {type.counted ? (
                    <pre className="font-mono text-green-400 text-xs leading-relaxed overflow-x-auto">
                      {customEventCode}
                    </pre>
                  ) : (
                    <code className="font-mono text-green-400 text-sm">
                      {type.example}
                    </code>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Benefits Grid */}
        <motion.div
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          className="rounded-2xl border bg-muted/30 p-8"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3 className="mb-6 text-center font-semibold text-lg">
            Why event-based pricing?
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  animate={
                    isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
                  }
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  key={benefit.title}
                  transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                >
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-orange-500/10">
                    <Icon className="size-6 text-orange-500" />
                  </div>
                  <h4 className="mb-1 font-medium">{benefit.title}</h4>
                  <p className="text-muted-foreground text-sm">
                    {benefit.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Comparison note */}
        <motion.p
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="mt-8 text-center text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Compare: Customer.io charges $150+/mo for 12K contacts. Wraps gives
          you unlimited contacts on every plan—even the free tier.
        </motion.p>
      </div>
    </section>
  );
}
