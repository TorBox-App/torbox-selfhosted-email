import type { Metadata } from "next";
import Script from "next/script";
import SESSandboxGuide from "./page-content";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need a live app before requesting AWS SES production access?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not necessarily, but your website needs to clearly show what your business does. A landing page with your value proposition, contact info, and privacy policy is sufficient. What matters is that reviewers can verify you're a real business.",
      },
    },
    {
      "@type": "Question",
      name: "Will a brand new domain cause my SES production request to be denied?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "New domains face more scrutiny but aren't automatically denied. Make your request extra detailed, ensure all DNS records are properly configured, and consider waiting a few weeks for the domain to age before requesting.",
      },
    },
    {
      "@type": "Question",
      name: "Can I request AWS SES production access for multiple accounts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, but each account needs its own request. If you're using AWS Organizations, submit from the account that will actually send emails. Requests from accounts with no other AWS usage face more scrutiny.",
      },
    },
    {
      "@type": "Question",
      name: "How long until my AWS SES sending limits automatically increase?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AWS monitors your sending reputation and automatically increases quotas over time. This typically happens within a few weeks of consistent, high-quality sending. Maintain bounce rates below 2% and complaint rates below 0.1%.",
      },
    },
    {
      "@type": "Question",
      name: "Should I use AWS SES or a third-party email provider?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SES is significantly cheaper at scale ($0.10/1000 emails) but requires more setup and management. If you want hands-off deliverability with dedicated IPs and better support, consider SendGrid, Postmark, or Mailgun. If you're comfortable with AWS and want to minimize costs, SES is excellent.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Get Out of AWS SES Sandbox",
  description:
    "The complete guide to SES production access approval. Interactive checklists, request templates, and everything you need to escape the sandbox on your first try.",
  image: "https://wraps.dev/blog/get-out-of-sandbox.png",
  datePublished: "2026-01-10T00:00:00.000Z",
  dateModified: "2026-01-10T00:00:00.000Z",
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
    "@id": "https://wraps.dev/blog/ses-sandbox-guide",
  },
};

export const metadata: Metadata = {
  title: "How to Get Out of AWS SES Sandbox",
  description:
    "The complete guide to SES production access approval. Interactive checklists, request templates, and everything you need to escape the sandbox on your first try.",
  openGraph: {
    title: "How to Get Out of AWS SES Sandbox | Wraps",
    description:
      "The complete guide to SES production access approval. Interactive checklists, request templates, and everything you need to escape the sandbox on your first try.",
    type: "article",
    url: "https://wraps.dev/blog/ses-sandbox-guide",
    images: [
      {
        url: "https://wraps.dev/blog/get-out-of-sandbox.png",
        width: 800,
        height: 421,
        alt: "How to Get Out of AWS SES Sandbox",
      },
    ],
    publishedTime: "2026-01-10T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Get Out of AWS SES Sandbox | Wraps",
    description:
      "The complete guide to SES production access approval. Checklists, templates, and everything you need.",
    images: ["https://wraps.dev/blog/get-out-of-sandbox.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/ses-sandbox-guide",
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
        <h1>How to Get Out of AWS SES Sandbox</h1>
        <p>
          The complete guide to SES production access approval. Interactive
          checklists, request templates, and everything you need to escape the
          sandbox on your first try.
        </p>
        <h2>Why Most Requests Get Denied</h2>
        <h2>Your AWS Account Matters</h2>
        <h2>Are You Ready to Submit?</h2>
        <h2>DNS Configuration</h2>
        <h2>Request Template Builder</h2>
        <h2>After You Submit</h2>
        <h2>Denied? Here's What to Do</h2>
        <h2>Alternative: Wraps CLI</h2>
        <h2>Frequently Asked Questions</h2>
        <h2>Additional Resources</h2>
      </article>
      <SESSandboxGuide />
    </>
  );
}
