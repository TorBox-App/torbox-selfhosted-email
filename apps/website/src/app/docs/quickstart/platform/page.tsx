import type { Metadata } from "next";
import Script from "next/script";
import PlatformQuickstartPageContent from "./page-content";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Docs", item: "https://wraps.dev/docs" },
    { "@type": "ListItem", position: 2, name: "Quickstart", item: "https://wraps.dev/docs/quickstart" },
    { "@type": "ListItem", position: 3, name: "Platform", item: "https://wraps.dev/docs/quickstart/platform" },
  ],
};

export const metadata: Metadata = {
  title: "Platform Quickstart",
  description:
    "Get started with the Wraps Platform for contacts and broadcasts.",
  openGraph: {
    title: "Platform Quickstart | Wraps",
    description:
      "Get started with the Wraps Platform for contacts and broadcasts.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/platform",
  },
  twitter: {
    title: "Platform Quickstart | Wraps",
    description:
      "Get started with the Wraps Platform for contacts and broadcasts.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/quickstart/platform",
  },
};

export default function PlatformQuickstartPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Platform Quickstart</h1>
        <p>Get started with the Wraps Platform for contacts and broadcasts.</p>
        <h2>Prerequisites</h2>
        <h2>Step 1: Connect Your Account</h2>
        <h2>Step 2: Import Contacts</h2>
        <h2>Step 3: Create Your First Broadcast</h2>
      </article>
      <PlatformQuickstartPageContent />
    </>
  );
}
