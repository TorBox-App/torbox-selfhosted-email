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
      "Two costs: a Wraps Platform fee (Free, $19, $79, or $199/mo depending on features) and AWS sending at $0.10/1K emails paid directly to AWS. No per-seat pricing, no per-contact pricing. The Free tier includes 5K tracked events/mo and a hosted dashboard.",
  },
  {
    id: "support",
    question: "What support is available?",
    answer:
      "Free: community support via GitHub and Discord. Starter ($19/mo): email support. Growth ($79/mo): priority support with 24-hour response. Scale ($199/mo): priority support with SLA.",
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
