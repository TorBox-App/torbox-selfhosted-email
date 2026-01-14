"use client";

import { ArrowRight, Check, Copy, Link2, RotateCcw, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const command = "npx @wraps.dev/cli email connect";

const benefits = [
  {
    icon: Shield,
    title: "Non-Destructive",
    description:
      "Always creates new resources with wraps-email- prefix. Your existing SES config stays untouched.",
  },
  {
    icon: Link2,
    title: "Incremental",
    description:
      "Add tracking to existing domains without reconfiguring. Works alongside your current setup.",
  },
  {
    icon: RotateCcw,
    title: "Reversible",
    description:
      "Remove Wraps anytime with 'wraps email destroy'. Your original SES infrastructure remains.",
  },
];

export function ExistingSesSection() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="border-y bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="mb-2 font-medium text-orange-500 text-sm">
            Already using SES?
          </p>
          <h2 className="mb-3 font-bold text-2xl tracking-tight sm:text-3xl">
            Add Wraps Without Replacing Anything
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Wraps deploys alongside your existing setup. We create new resources
            with the <code className="rounded bg-muted px-1.5 py-0.5 text-sm">wraps-email-</code> prefix—your
            current infrastructure stays untouched.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="mb-10 grid gap-6 sm:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                className="rounded-xl border bg-background p-5 transition-colors hover:border-orange-500/50"
                key={benefit.title}
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <Icon className="size-5 text-orange-500" />
                </div>
                <h3 className="mb-1 font-semibold">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <button
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500/30 bg-background px-5 py-3 font-mono text-sm transition-colors hover:border-orange-500 hover:bg-orange-500/5"
            onClick={copyToClipboard}
            type="button"
          >
            <span className="text-muted-foreground">$</span>
            <span>{command}</span>
            {copied ? (
              <Check className="size-4 text-green-500" />
            ) : (
              <Copy className="size-4 text-muted-foreground" />
            )}
          </button>
          <Button
            asChild
            className="group cursor-pointer text-muted-foreground"
            size="sm"
            variant="link"
          >
            <a href="/docs/cli-reference/email#connect">
              Learn more about connecting existing SES
              <ArrowRight className="ml-1 size-3 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
