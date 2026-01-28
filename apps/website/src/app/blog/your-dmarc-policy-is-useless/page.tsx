import type { Metadata } from "next";
import Script from "next/script";
import DMARCSucks from "./page-content";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is DMARC and why does it matter?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "DMARC (Domain-based Message Authentication, Reporting & Conformance) is an email authentication protocol that protects your domain from spoofing. It tells receiving servers what to do with emails that fail SPF and DKIM checks. Without DMARC or with p=none, attackers can send emails pretending to be from your domain.",
      },
    },
    {
      "@type": "Question",
      name: "What does p=none mean in DMARC?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "p=none means 'monitor only' - it tells receiving servers not to take any action on emails that fail DMARC checks. While useful for initial setup and collecting reports, it provides zero protection against spoofing. Attackers can still send emails as your domain and they'll be delivered normally.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between p=quarantine and p=reject?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "p=quarantine tells receivers to send failing emails to spam/junk folders, while p=reject tells them to block the emails entirely. p=reject provides the strongest protection but should only be used after monitoring with p=none to ensure legitimate emails pass authentication.",
      },
    },
    {
      "@type": "Question",
      name: "How do SPF, DKIM, and DMARC work together?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SPF verifies the sending server is authorized, DKIM cryptographically signs emails to prove they weren't modified, and DMARC ties them together by requiring alignment between the From header and SPF/DKIM domains. For DMARC to pass, either SPF or DKIM must both pass and align with the From domain.",
      },
    },
    {
      "@type": "Question",
      name: "Why do Google and Yahoo now require DMARC?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Starting in 2024, Google and Yahoo require bulk senders (5,000+ emails/day) to have valid DMARC records. This is part of industry-wide efforts to reduce spam and phishing. Domains without proper email authentication may see their emails rejected or sent to spam.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Your DMARC Policy is Useless",
  description:
    "82% of domains have no DMARC. Of those that do, most set p=none—which tells receivers not to enforce. An interactive deep-dive into email authentication.",
  image: "https://wraps.dev/blog/dmarc-policy-is-useless.png",
  datePublished: "2025-01-15T00:00:00.000Z",
  dateModified: "2025-01-15T00:00:00.000Z",
  author: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
    description:
      "Email infrastructure experts building tools to deploy production-ready email systems to AWS. Specialists in email deliverability, authentication (SPF, DKIM, DMARC), and AWS SES.",
    sameAs: ["https://github.com/wraps-team", "https://twitter.com/wrapsdev"],
  },
  publisher: {
    "@type": "Organization",
    name: "Wraps",
    logo: {
      "@type": "ImageObject",
      url: "https://wraps.dev/logo.png",
    },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://wraps.dev/blog/your-dmarc-policy-is-useless",
  },
};

export const metadata: Metadata = {
  title: "Your DMARC Policy is Useless",
  description:
    "82% of domains have no DMARC. Of those that do, most set p=none—which tells receivers not to enforce. An interactive deep-dive into email authentication.",
  openGraph: {
    title: "Your DMARC Policy is Useless | Wraps",
    description:
      "82% of domains have no DMARC. Of those that do, most set p=none—which tells receivers not to enforce. An interactive deep-dive into email authentication.",
    type: "article",
    url: "https://wraps.dev/blog/your-dmarc-policy-is-useless",
    images: [
      {
        url: "https://wraps.dev/blog/dmarc-policy-is-useless.png",
        width: 800,
        height: 421,
        alt: "Your DMARC policy is useless",
      },
    ],
    publishedTime: "2025-01-15T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your DMARC Policy is Useless | Wraps",
    description:
      "82% of domains have no DMARC. Of those that do, most set p=none. An interactive deep-dive into email authentication.",
    images: ["https://wraps.dev/blog/dmarc-policy-is-useless.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/your-dmarc-policy-is-useless",
  },
};

export default function Page() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        id="article-schema"
        type="application/ld+json"
      />
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        id="faq-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO - visually hidden but accessible to crawlers */}
      <article aria-hidden="true" className="sr-only">
        <h1>Your DMARC Policy is Useless</h1>
        <p>
          82% of domains have no DMARC. Of those that do, most set p=none—which
          tells receivers not to enforce. An interactive deep-dive into email
          authentication.
        </p>
        <h2>The State of DMARC Adoption</h2>
        <h2>Regulators are finally forcing the issue</h2>
        <h2>See what happens when a spoofed email arrives</h2>
        <h2>How email authentication actually works</h2>
        <h2>Real-world email security incidents</h2>
        <h2>The fix: From p=none to p=reject</h2>
      </article>
      <DMARCSucks />
    </>
  );
}
