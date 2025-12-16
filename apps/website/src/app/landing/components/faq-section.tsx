"use client";

import { CircleHelp } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionWrapper, SectionCard } from "./section-card";

type FaqItem = {
  value: string;
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    value: "item-0a",
    question: "Why is email SaaS so expensive?",
    answer:
      "Email providers like Postmark, Mailgun, and others charge $2-4+ per 1,000 emails because they're running infrastructure for you. AWS SES charges $0.10/1K because you're running it yourself. Wraps bridges this gap—you get AWS pricing with modern DX.",
  },
  {
    value: "item-0b",
    question: "Why is AWS SES so hard to set up?",
    answer:
      "SES requires configuring IAM roles, EventBridge rules, DynamoDB tables, Lambda functions, and SQS queues for proper email tracking. That's 2+ hours of clicking through the AWS Console. Wraps does this in one command.",
  },
  {
    value: "item-1",
    question: "How is this different from using AWS SES directly?",
    answer:
      "Wraps deploys all the infrastructure AWS SES needs (IAM roles, EventBridge, DynamoDB, Lambda, SQS) in one command instead of 2+ hours of manual setup. You get event tracking, analytics, and a dashboard out of the box. The TypeScript SDK is just `wraps.emails.send()` - no boilerplate.",
  },
  {
    value: "item-2",
    question: "What are the costs for running Wraps?",
    answer:
      "With Wraps, you pay AWS directly at $0.10 per 1,000 emails with no markup. For example, 50,000 emails/month costs ~$5 to AWS. The CLI and SDK are free forever. The hosted dashboard with template editor starts at $10/month. The infrastructure is yours forever—no vendor lock-in, no surprise bills.",
  },
  {
    value: "item-3",
    question: "Do you store my AWS credentials?",
    answer:
      "No! We use OIDC (OpenID Connect) for Vercel deployments or IAM roles for AWS-native deployments. The CLI uses your local AWS credentials for the initial deployment, then creates IAM roles that your app can assume. We never see or store your AWS access keys.",
  },
  {
    value: "item-4",
    question: "What happens if I stop paying for Wraps?",
    answer:
      "Your infrastructure keeps running! All resources are in your AWS account. You lose access to the hosted dashboard (if you had it) but can still use the free local console. Your SDK code keeps working, emails keep sending, and you keep paying AWS directly. Zero vendor lock-in.",
  },
  {
    value: "item-5",
    question: "Can I customize the infrastructure deployment?",
    answer:
      "Yes! The CLI offers infrastructure presets for different needs—from minimal tracking to full analytics with dedicated IPs. You can also use 'npx @wraps.dev/cli email upgrade' to add features incrementally. For full customization, all infrastructure is deployed as open-source Pulumi code you can fork and modify.",
  },
  {
    value: "item-6",
    question: "Does this work with my existing SES setup?",
    answer:
      "Yes! Use 'npx @wraps.dev/cli email connect' to scan your existing SES resources and add Wraps features non-destructively. We never modify existing resources—all our infrastructure uses the 'wraps-email-' prefix. You can also use 'npx @wraps.dev/cli email init' for a completely fresh deployment.",
  },
];

const FaqSection = () => {
  return (
    <SectionWrapper
      badge="FAQ"
      description="Everything you need to know about Wraps, pricing, security, and deployment."
      id="faq"
      title="Frequently Asked Questions"
    >
      <SectionCard
        footer={{
          title: "Still have questions?",
          description:
            "We're here to help. Reach out and we'll get back to you as soon as possible.",
          ctaText: "Contact Support",
          ctaLink: "mailto:support@wraps.dev",
        }}
      >
        <Accordion className="space-y-3" collapsible type="single">
          {faqItems.map((item) => (
            <AccordionItem
              className="rounded-lg border bg-background px-4"
              key={item.value}
              value={item.value}
            >
              <AccordionTrigger className="cursor-pointer gap-4 py-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500/5 text-orange-500">
                    <CircleHelp className="size-4" />
                  </div>
                  <span className="font-medium">{item.question}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pl-11 text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionCard>
    </SectionWrapper>
  );
};

export { FaqSection };
