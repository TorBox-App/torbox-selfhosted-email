"use client";

import { ArrowRight, BookOpen, Check, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const benefits = [
  "Toll-free numbers included",
  "TypeScript SDK",
  "Zero vendor lock-in",
  "Real-time dashboard",
];

export function SmsCtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border-2 border-orange-500/30 bg-orange-500/5">
          <div className="p-8 md:p-12">
            <div className="mx-auto max-w-2xl text-center">
              {/* Icon */}
              <div className="mb-6 flex justify-center">
                <div className="flex size-16 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500/10">
                  <MessageSquare className="size-8 text-orange-500" />
                </div>
              </div>

              {/* Headline */}
              <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
                Start sending SMS today
              </h2>

              {/* Description */}
              <p className="mb-8 text-muted-foreground">
                Deploy SMS infrastructure to your AWS account in under 2
                minutes. Same BYOC model as email — you own everything, pay AWS
                directly.
              </p>

              {/* Benefits */}
              <div className="mb-8 flex flex-wrap justify-center gap-4">
                {benefits.map((benefit) => (
                  <div
                    className="flex items-center gap-2 text-sm"
                    key={benefit}
                  >
                    <Check className="size-4 text-orange-500" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button
                  asChild
                  className="bg-orange-500 hover:bg-orange-600"
                  size="lg"
                >
                  <Link href="/docs/quickstart/sms">
                    Get Started
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/docs/cli-reference/sms">
                    <BookOpen className="mr-1.5 size-4" />
                    CLI Reference
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
