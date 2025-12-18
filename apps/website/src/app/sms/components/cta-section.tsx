"use client";

import { Check, MessageSquare } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

const benefits = [
  "Early access to the SMS beta",
  "Direct input on features",
  "Founding customer pricing",
  "Priority support",
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
                Be first in line for SMS
              </h2>

              {/* Description */}
              <p className="mb-8 text-muted-foreground">
                We're building SMS with the same BYOC model that makes our email
                product compelling. Join the waitlist to get early access and
                help shape the product.
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

              {/* Waitlist Form */}
              <div className="mx-auto max-w-md">
                <WaitlistForm source="sms-cta" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
