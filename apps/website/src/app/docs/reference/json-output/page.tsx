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
      name: "Reference",
      item: "https://wraps.dev/docs/reference",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "JSON Output",
      item: "https://wraps.dev/docs/reference/json-output",
    },
  ],
};

export const metadata: Metadata = {
  title: "JSON Output Reference",
  description:
    "Complete reference for Wraps CLI --json flag. Machine-readable output schemas for every command.",
  openGraph: {
    title: "JSON Output Reference | Wraps",
    description:
      "Complete reference for Wraps CLI --json flag. Machine-readable output schemas for every command.",
    type: "website",
    url: "https://wraps.dev/docs/reference/json-output",
  },
  twitter: {
    title: "JSON Output Reference | Wraps",
    description:
      "Complete reference for Wraps CLI --json flag. Machine-readable output schemas for every command.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/reference/json-output",
  },
};

export default function JSONOutputReferencePage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>JSON Output Reference</h1>
        <p>Machine-readable output schemas for every CLI command.</p>
        <h2>Envelope Format</h2>
        <h2>Usage</h2>
        <h2>Email Commands</h2>
        <h2>SMS Commands</h2>
        <h2>CDN Commands</h2>
        <h2>Auth Commands</h2>
        <h2>Platform Commands</h2>
        <h2>Error Handling</h2>
      </article>
      <PageContent />
    </>
  );
}
