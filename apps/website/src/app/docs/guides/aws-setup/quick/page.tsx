import type { Metadata } from "next";
import Script from "next/script";
import QuickStartPageContent from "./page-content";

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
      name: "Quick Start",
      item: "https://wraps.dev/docs/guides/aws-setup/quick",
    },
  ],
};

export const metadata: Metadata = {
  title: "Quick AWS Setup",
  description: "Fast track AWS setup for Wraps.",
  openGraph: {
    title: "Quick AWS Setup | Wraps",
    description: "Fast track AWS setup for Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/quick",
  },
  twitter: {
    title: "Quick AWS Setup | Wraps",
    description: "Fast track AWS setup for Wraps.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/aws-setup/quick",
  },
};

export default function QuickStartPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Quick AWS Setup</h1>
        <p>Fast track AWS setup for Wraps - get started in minutes.</p>
      </article>
      <QuickStartPageContent />
    </>
  );
}
