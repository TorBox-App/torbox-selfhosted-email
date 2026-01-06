"use client";

import { Check, X } from "lucide-react";
import { SectionWrapper } from "@/app/landing/components/section-card";

const pricingComparison = [
  { volume: "10K/mo", wraps: "~$127", twilio: "~$150", savings: "15%" },
  { volume: "50K/mo", wraps: "~$520", twilio: "~$750", savings: "31%" },
  { volume: "100K/mo", wraps: "~$1,000", twilio: "~$1,500", savings: "33%" },
];

const featureComparison = [
  { feature: "Own your infrastructure", wraps: true, twilio: false },
  { feature: "Transparent AWS pricing", wraps: true, twilio: false },
  { feature: "No platform markup", wraps: true, twilio: false },
  { feature: "Data residency control", wraps: true, twilio: false },
  { feature: "TypeScript SDK", wraps: true, twilio: true },
  { feature: "Two-way messaging", wraps: true, twilio: true },
];

export function SmsPricingSection() {
  return (
    <SectionWrapper
      badge="Pricing"
      description="Pay AWS directly. Save up to 33% compared to Twilio."
      id="pricing"
      title="Transparent pricing"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Cost Comparison */}
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b bg-muted/50 px-6 py-4">
            <h3 className="font-semibold">Monthly Cost Comparison</h3>
          </div>
          <div className="p-6">
            <table className="w-full">
              <thead>
                <tr className="text-left text-muted-foreground text-sm">
                  <th className="pb-4">Volume</th>
                  <th className="pb-4">
                    <span className="text-orange-500">Wraps</span> (AWS)
                  </th>
                  <th className="pb-4">Twilio</th>
                  <th className="pb-4">Savings</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {pricingComparison.map((row) => (
                  <tr className="border-t" key={row.volume}>
                    <td className="py-3 font-medium">{row.volume}</td>
                    <td className="py-3 text-orange-500">{row.wraps}</td>
                    <td className="py-3 text-muted-foreground">{row.twilio}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-green-500/10 px-2 py-1 font-medium text-green-600 text-xs dark:text-green-400">
                        {row.savings}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-muted-foreground text-xs">
              * Includes toll-free number ($2/mo), carrier fees, and message
              costs. Wraps Platform sold separately.
            </p>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b bg-muted/50 px-6 py-4">
            <h3 className="font-semibold">Feature Comparison</h3>
          </div>
          <div className="p-6">
            <table className="w-full">
              <thead>
                <tr className="text-left text-muted-foreground text-sm">
                  <th className="pb-4">Feature</th>
                  <th className="pb-4 text-center">
                    <span className="text-orange-500">Wraps</span>
                  </th>
                  <th className="pb-4 text-center">Twilio</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {featureComparison.map((row) => (
                  <tr className="border-t" key={row.feature}>
                    <td className="py-3">{row.feature}</td>
                    <td className="py-3 text-center">
                      {row.wraps ? (
                        <Check className="mx-auto size-5 text-green-500" />
                      ) : (
                        <X className="mx-auto size-5 text-muted-foreground" />
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {row.twilio ? (
                        <Check className="mx-auto size-5 text-green-500" />
                      ) : (
                        <X className="mx-auto size-5 text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
