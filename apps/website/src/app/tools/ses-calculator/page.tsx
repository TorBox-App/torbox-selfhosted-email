import type { Metadata } from "next";
import SESCalculatorPageContent from "./page-content";

export const metadata: Metadata = {
  title: "AWS SES Cost Calculator",
  description:
    "Calculate your true AWS SES email costs including infrastructure (Lambda, DynamoDB, SQS, EventBridge). The only SES pricing calculator that shows full production costs, not just the $0.10/1K sending fee.",
  openGraph: {
    title: "AWS SES Cost Calculator | Wraps",
    description:
      "Calculate your true AWS SES costs including infrastructure. See full production email costs beyond the $0.10/1K headline price.",
  },
  twitter: {
    title: "AWS SES Cost Calculator | Wraps",
    description:
      "Calculate your true AWS SES costs including infrastructure. See full production email costs beyond the $0.10/1K headline price.",
  },
  alternates: {
    canonical: "https://wraps.dev/tools/ses-calculator",
  },
};

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AWS SES Cost Calculator",
  description:
    "Interactive calculator for estimating AWS SES email costs including full infrastructure pricing for Lambda, DynamoDB, SQS, EventBridge, dedicated IPs, and more.",
  url: "https://wraps.dev/tools/ses-calculator",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  provider: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
  },
  featureList: [
    "AWS SES sending cost calculation",
    "Full infrastructure cost breakdown (Lambda, DynamoDB, SQS, EventBridge)",
    "Feature-based pricing (event tracking, dedicated IP, HTTPS tracking)",
    "AWS Free Tier calculations included",
    "Shareable calculator configurations via URL",
    "Volume presets for common use cases",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much does AWS SES cost per email?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AWS SES costs $0.10 per 1,000 emails ($0.0001 per email) for sending. However, a production email setup also requires infrastructure for event processing and storage — EventBridge, SQS, Lambda, and DynamoDB — which typically adds $1-5/month depending on volume.",
      },
    },
    {
      "@type": "Question",
      name: "What is the total cost of running AWS SES in production?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For a typical startup sending 50,000 emails/month with event tracking and 90-day history retention, expect roughly $5-10/month total including SES sending fees and supporting infrastructure. Most AWS services include generous free tiers that cover low-volume usage.",
      },
    },
    {
      "@type": "Question",
      name: "Does AWS SES have a free tier?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SES itself charges $0.10 per 1,000 emails with no permanent free sending tier. However, the supporting infrastructure benefits from AWS free tiers: 1 million Lambda requests/month, 1 million SQS requests/month, and 25 GB of DynamoDB storage.",
      },
    },
    {
      "@type": "Question",
      name: "How much does a dedicated IP cost in AWS SES?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A dedicated IP address in AWS SES costs $24.95 per month. Dedicated IPs are recommended for senders with consistent volume over 100,000 emails per day, as they give you full control over your sending IP reputation.",
      },
    },
    {
      "@type": "Question",
      name: "Is AWS SES cheaper than SendGrid, Resend, or Postmark?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AWS SES is significantly cheaper at scale. SES costs $0.10 per 1,000 emails with no monthly minimum. By comparison, SendGrid starts at $19.95/month for 50K emails and Resend starts at $20/month. The trade-off is SES requires infrastructure setup, which tools like Wraps automate with a single command.",
      },
    },
  ],
};

export default function SESCalculatorPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        suppressHydrationWarning
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        suppressHydrationWarning
        type="application/ld+json"
      />
      <h1 className="sr-only">AWS SES Cost Calculator</h1>
      <SESCalculatorPageContent />
    </>
  );
}
