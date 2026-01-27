import type { Metadata } from "next";
import Script from "next/script";
import GuidesPageContent from "./page-content";

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
  ],
};

export const metadata: Metadata = {
  title: "Guides",
  description:
    "In-depth guides for production access, domain verification, and AWS setup.",
  openGraph: {
    title: "Guides | Wraps",
    description:
      "In-depth guides for production access, domain verification, and AWS setup.",
    type: "website",
    url: "https://wraps.dev/docs/guides",
  },
  twitter: {
    title: "Guides | Wraps",
    description:
      "In-depth guides for production access, domain verification, and AWS setup.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides",
  },
};

export default function GuidesPage() {
  return (
    <>
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Server-rendered content for SEO */}
      <nav className="sr-only" aria-hidden="true">
        <h1>Wraps Guides</h1>
        <p>In-depth guides for production access, domain verification, and AWS setup.</p>
        <h2>Available Guides</h2>
        <ul>
          <li>AWS Setup - Configure your AWS account for Wraps</li>
          <li>Production Access - Get AWS SES production access approval</li>
          <li>Domain Verification - Set up DKIM, SPF, and DMARC</li>
        </ul>
      </nav>
      <GuidesPageContent />
    </>
  );
}
