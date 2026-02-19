"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    id: "cost",
    question: "What's the total cost of ownership?",
    answer:
      "AWS costs: $0.10/1K emails + ~$2-5/mo infrastructure. There's a free tier with 1,000 messages/month and hosted dashboard. Paid plans start at $29/mo for 10,000 messages with usage-based overages. No hidden fees, no per-seat pricing.",
  },
  {
    id: "support",
    question: "What support is available?",
    answer:
      "Free tier: GitHub issues and community Discord. Paid dashboard: 48-hour email support. Enterprise: Dedicated support and SLAs available on request.",
  },
  {
    id: "compare",
    question: "How does this compare to building our own SES integration?",
    answer:
      "Building SES integration with proper event tracking, bounce handling, and analytics takes 40-80 engineering hours. Wraps does it in 2 minutes. You get the same infrastructure, just automated.",
  },
  {
    id: "migration",
    question: "What's the migration path from our current provider?",
    answer:
      "Deploy Wraps alongside your current provider, migrate traffic gradually, then decommission the old one. Your sending domain stays the same. Most teams migrate in a day.",
  },
  {
    id: "customize",
    question: "Can we customize the infrastructure?",
    answer:
      "Yes. The CLI offers presets (Starter, Production, Enterprise) or full customization. All infrastructure is Pulumi code you can fork and modify. Add your own Lambda triggers, change retention periods, etc.",
  },
];

export function FaqSection() {
  return (
    <section className="mb-16">
      <h2 className="mb-6 font-semibold text-2xl">Common Questions</h2>
      <Accordion className="space-y-2" collapsible type="single">
        {faqItems.map((item) => (
          <AccordionItem
            className="rounded-lg border px-4"
            key={item.id}
            value={item.id}
          >
            <AccordionTrigger className="text-left hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
