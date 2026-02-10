import type { Metadata } from "next";
import Script from "next/script";
import PulumiReferencePageContent from "./page-content";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Docs", item: "https://wraps.dev/docs" },
    { "@type": "ListItem", position: 2, name: "Pulumi Component", item: "https://wraps.dev/docs/pulumi-reference" },
  ],
};

export const metadata: Metadata = {
  title: "Pulumi Component Reference",
  description: "Deploy Wraps infrastructure with Pulumi.",
  openGraph: {
    title: "Pulumi Component Reference | Wraps",
    description: "Deploy Wraps infrastructure with Pulumi.",
    type: "website",
    url: "https://wraps.dev/docs/pulumi-reference",
  },
  twitter: {
    title: "Pulumi Component Reference | Wraps",
    description: "Deploy Wraps infrastructure with Pulumi.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/pulumi-reference",
  },
};

export default function PulumiReferencePage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Pulumi Component Reference</h1>
        <p>Deploy Wraps infrastructure with Pulumi.</p>
        <h2>Installation</h2>
        <h2>Usage</h2>
        <h2>Configuration Options</h2>
      </article>
      <PulumiReferencePageContent />
    </>
  );
}
