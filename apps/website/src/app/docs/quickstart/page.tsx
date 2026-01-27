import type { Metadata } from "next";
import Script from "next/script";
import QuickstartPageContent from "./page-content";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Docs",
      item: "https://wraps.dev/docs",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Quickstart",
      item: "https://wraps.dev/docs/quickstart",
    },
  ],
};

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Deploy your first email infrastructure in 2 minutes with the Wraps CLI.",
  openGraph: {
    title: "Quickstart | Wraps",
    description:
      "Deploy your first email infrastructure in 2 minutes with the Wraps CLI.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart",
  },
  twitter: {
    title: "Quickstart | Wraps",
    description:
      "Deploy your first email infrastructure in 2 minutes with the Wraps CLI.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/quickstart",
  },
};

export default function QuickstartPage() {
  return (
    <>
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Wraps Quickstart Guide</h1>
        <p>Deploy your first email infrastructure in 2 minutes with the Wraps CLI.</p>
        <h2>Choose Your Quickstart</h2>
        <ul>
          <li>Email - Send emails through AWS SES</li>
          <li>SMS - Send SMS through AWS Pinpoint</li>
          <li>CDN - Deploy CDN for email assets</li>
          <li>Platform - Contacts and broadcasts</li>
        </ul>
      </article>
      <QuickstartPageContent />
    </>
  );
}
