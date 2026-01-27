import type { Metadata } from "next";
import Script from "next/script";
import SPFGuidePage from "./page-content";

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "The SPF 10-Lookup Limit: Why Your Email Might Be Failing",
  description:
    "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted, which providers cost the most, and how to stay under the limit.",
  image: "https://wraps.dev/og-image.png",
  datePublished: "2026-01-12T00:00:00.000Z",
  dateModified: "2026-01-12T00:00:00.000Z",
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
    "@id": "https://wraps.dev/blog/spf-guide",
  },
};

export const metadata: Metadata = {
  title: "The SPF 10-Lookup Limit: Why Your Email Might Be Failing",
  description:
    "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted, which providers cost the most, and how to stay under the limit.",
  openGraph: {
    title: "The SPF 10-Lookup Limit | Wraps",
    description:
      "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted, which providers cost the most, and how to stay under the limit.",
    type: "article",
    url: "https://wraps.dev/blog/spf-guide",
    images: [
      {
        url: "https://wraps.dev/og-image.png",
        width: 1200,
        height: 630,
        alt: "SPF 10-Lookup Limit Guide",
      },
    ],
    publishedTime: "2026-01-12T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The SPF 10-Lookup Limit | Wraps",
    description:
      "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted and how to stay under.",
    images: ["https://wraps.dev/og-image.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/spf-guide",
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
        <h1>The SPF 10-Lookup Limit: Why Your Email Might Be Failing</h1>
        <p>
          SPF looks simple until you hit the 10-lookup limit. Learn how lookups
          are counted, which providers cost the most, and how to stay under the
          limit.
        </p>
        <h2>What is SPF?</h2>
        <h2>The 10-Lookup Problem</h2>
        <h2>How Lookups Are Counted</h2>
        <h2>Provider Lookup Costs</h2>
        <h2>SPF Flattening</h2>
        <h2>SPF Best Practices</h2>
        <h2>Additional Resources</h2>
      </article>
      <SPFGuidePage />
    </>
  );
}
