import { Button } from "@wraps/ui/components/ui/button";
import { BookOpen, Check } from "lucide-react";
import Link from "next/link";

const benefits = [
  "Toll-free numbers included",
  "TypeScript SDK",
  "Zero vendor lock-in",
  "Real-time dashboard",
];

export function SmsCtaSection() {
  return (
    <section className="border-border border-t py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border bg-card p-8 md:p-12">
          <div className="max-w-2xl">
            {/* Mono tag */}
            <div className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              <span className="size-1.5 rounded-full bg-orange-500" />
              <span>wraps · sms</span>
            </div>

            {/* Headline */}
            <h2 className="mb-4 font-heading font-semibold text-3xl tracking-tight md:text-4xl">
              Start sending SMS <span className="text-orange-500">today</span>
            </h2>

            {/* Description */}
            <p className="mb-8 text-muted-foreground">
              Deploy SMS infrastructure to your AWS account in under 2 minutes.
              Same BYOC model as email — you own everything, pay AWS directly.
            </p>

            {/* Benefits */}
            <div className="mb-8 flex flex-wrap gap-x-6 gap-y-3">
              {benefits.map((benefit) => (
                <div className="flex items-center gap-2 text-sm" key={benefit}>
                  <Check
                    aria-hidden="true"
                    className="size-4 text-orange-500"
                  />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="bg-orange-500 text-white hover:bg-orange-600"
                size="lg"
              >
                <Link href="/docs/quickstart/sms">Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/docs/cli-reference/sms">
                  <BookOpen aria-hidden="true" className="me-2 size-4" />
                  CLI Reference
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
