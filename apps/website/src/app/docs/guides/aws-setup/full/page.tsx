import type { Metadata } from "next";
import Script from "next/script";
import FullGuidePageContent from "./page-content";

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
      name: "AWS Setup",
      item: "https://wraps.dev/docs/guides/aws-setup",
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Full Setup",
      item: "https://wraps.dev/docs/guides/aws-setup/full",
    },
  ],
};

export const metadata: Metadata = {
  title: "Full AWS Setup",
  description: "Complete AWS setup guide for Wraps.",
  openGraph: {
    title: "Full AWS Setup | Wraps",
    description: "Complete AWS setup guide for Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/full",
  },
  twitter: {
    title: "Full AWS Setup | Wraps",
    description: "Complete AWS setup guide for Wraps.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/aws-setup/full",
  },
};

export default function FullGuidePage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>Full AWS Setup</h2>
        <p>Complete AWS setup guide for Wraps with detailed explanations.</p>
      </article>
      <FullGuidePageContent />
    </>
  );
}
