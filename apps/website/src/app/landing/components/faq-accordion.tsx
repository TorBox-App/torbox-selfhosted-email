"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@wraps/ui/components/ui/accordion";
import { faqItems } from "./faq-items";

export function FaqAccordion() {
  return (
    <Accordion collapsible type="single">
      {faqItems.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger className="cursor-pointer text-left">
            <span className="font-medium">{item.question}</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {item.richAnswer ?? item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
