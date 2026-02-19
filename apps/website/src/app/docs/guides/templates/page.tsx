import type { Metadata } from "next";
import Script from "next/script";
import PageContent from "./page-content";

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
      name: "Guides",
      item: "https://wraps.dev/docs/guides",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Templates as Code",
      item: "https://wraps.dev/docs/guides/templates",
    },
  ],
};

export const metadata: Metadata = {
  title: "Templates as Code",
  description:
    "Write email templates as React components, preview them locally, and push to SES and the Wraps dashboard.",
  openGraph: {
    title: "Templates as Code | Wraps",
    description:
      "Write email templates as React components, preview them locally, and push to SES and the Wraps dashboard.",
    type: "website",
    url: "https://wraps.dev/docs/guides/templates",
  },
  twitter: {
    title: "Templates as Code | Wraps",
    description:
      "Write email templates as React components, preview them locally, and push to SES and the Wraps dashboard.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/templates",
  },
};

export default function TemplatesPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>Templates as Code</h2>
        <p>
          Write email templates as React components, preview them locally, and
          push to SES and the Wraps dashboard.
        </p>
        <h2>Getting Started</h2>
        <h2>Configuration</h2>
        <h2>Writing Templates</h2>
        <h2>Preview</h2>
        <h2>Push to SES</h2>
        <h2>Sending with Templates</h2>
      </article>
      <PageContent />
    </>
  );
}
