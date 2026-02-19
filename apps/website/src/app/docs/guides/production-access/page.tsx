import type { Metadata } from "next";
import Script from "next/script";
import ProductionAccessPageContent from "./page-content";

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
      name: "Production Access",
      item: "https://wraps.dev/docs/guides/production-access",
    },
  ],
};

export const metadata: Metadata = {
  title: "Production Access Guide",
  description:
    "Step-by-step guide to getting AWS SES production access approval. Includes request templates, common rejection reasons, and best practices for approval.",
  openGraph: {
    title: "Production Access Guide | Wraps",
    description:
      "Step-by-step guide to getting AWS SES production access approval. Includes request templates and best practices.",
    type: "website",
    url: "https://wraps.dev/docs/guides/production-access",
  },
  twitter: {
    title: "Production Access Guide | Wraps",
    description:
      "Step-by-step guide to getting AWS SES production access approval. Includes templates and best practices.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/production-access",
  },
};

export default function ProductionAccessPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>Production Access Guide</h2>
        <p>How to get AWS SES production access approval.</p>
        <h2>Prerequisites</h2>
        <h2>Request Process</h2>
        <h2>Common Rejection Reasons</h2>
        <h2>Best Practices</h2>
      </article>
      <ProductionAccessPageContent />
    </>
  );
}
