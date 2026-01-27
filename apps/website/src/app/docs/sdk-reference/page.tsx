import type { Metadata } from "next";
import Script from "next/script";
import SDKReferencePageContent from "./page-content";

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
      name: "Email SDK Reference",
      item: "https://wraps.dev/docs/sdk-reference",
    },
  ],
};

export const metadata: Metadata = {
  title: "Email SDK Reference",
  description: "Complete reference for @wraps.dev/email TypeScript SDK.",
  openGraph: {
    title: "Email SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/email TypeScript SDK.",
    type: "website",
    url: "https://wraps.dev/docs/sdk-reference",
  },
  twitter: {
    title: "Email SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/email TypeScript SDK.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/sdk-reference",
  },
};

export default function SDKReferencePage() {
  return (
    <>
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Email SDK Reference</h1>
        <p>Complete reference for @wraps.dev/email TypeScript SDK.</p>
        <h2>Installation</h2>
        <h2>Configuration</h2>
        <h2>Sending Emails</h2>
        <h2>Templates</h2>
        <h2>Error Handling</h2>
      </article>
      <SDKReferencePageContent />
    </>
  );
}
