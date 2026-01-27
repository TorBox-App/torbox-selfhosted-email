import type { Metadata } from "next";
import Script from "next/script";
import SESProductionArchitecture from "./page-content";

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AWS SES Production Architecture Guide",
  description:
    "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, configuration sets, and the patterns that protect your sender reputation.",
  image: "https://wraps.dev/blog/ses-production-architecture.png",
  datePublished: "2026-01-21T00:00:00.000Z",
  dateModified: "2026-01-21T00:00:00.000Z",
  author: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
    description:
      "Email infrastructure experts building tools to deploy production-ready email systems to AWS. Specialists in email deliverability, authentication (SPF, DKIM, DMARC), and AWS SES.",
    sameAs: [
      "https://github.com/wraps-team",
      "https://twitter.com/wrapsdev",
    ],
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
    "@id": "https://wraps.dev/blog/ses-production-architecture",
  },
};

export const metadata: Metadata = {
  title: "AWS SES Production Architecture Guide",
  description:
    "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, configuration sets, and the patterns that protect your sender reputation.",
  openGraph: {
    title: "AWS SES Production Architecture Guide | Wraps",
    description:
      "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, and the patterns that protect your sender reputation.",
    type: "article",
    url: "https://wraps.dev/blog/ses-production-architecture",
    images: [
      {
        url: "https://wraps.dev/blog/ses-production-architecture.png",
        width: 1200,
        height: 630,
        alt: "AWS SES Production Architecture Guide",
      },
    ],
    publishedTime: "2026-01-21T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AWS SES Production Architecture Guide | Wraps",
    description:
      "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, and monitoring.",
    images: ["https://wraps.dev/blog/ses-production-architecture.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/ses-production-architecture",
  },
};

export default function Page() {
  return (
    <>
      <Script
        id="article-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {/* Server-rendered content for SEO - visually hidden but accessible to crawlers */}
      <article className="sr-only" aria-hidden="true">
        <h1>AWS SES Production Architecture Guide</h1>
        <p>
          Everything you need to deploy SES at scale: dedicated IPs, bounce
          handling, rate limiting, configuration sets, and the patterns that
          protect your sender reputation.
        </p>
        <h2>The Production SES Stack</h2>
        <h2>Dedicated IPs: When & Why</h2>
        <h2>Configuration Set Architecture</h2>
        <h2>Event Processing Pipeline</h2>
        <h2>Rate Limiting Architecture</h2>
        <h2>CloudWatch Monitoring</h2>
        <h2>Common Mistakes That Kill Deliverability</h2>
      </article>
      <SESProductionArchitecture />
    </>
  );
}
