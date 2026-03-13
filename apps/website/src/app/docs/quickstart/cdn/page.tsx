import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import CdnQuickstartPageContent from "./page-content";

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
    {
      "@type": "ListItem",
      position: 3,
      name: "CDN",
      item: "https://wraps.dev/docs/quickstart/cdn",
    },
  ],
};

export const metadata: Metadata = {
  title: "CDN Quickstart",
  description: "Deploy a CDN for your email assets with Wraps.",
  openGraph: {
    title: "CDN Quickstart | Wraps",
    description: "Deploy a CDN for your email assets with Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/cdn",
  },
  twitter: {
    title: "CDN Quickstart | Wraps",
    description: "Deploy a CDN for your email assets with Wraps.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/quickstart/cdn",
  },
};

export default function CdnQuickstartPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>CDN Quickstart</h2>
        <p>Deploy a CDN for your email assets with Wraps.</p>
        <h2>Prerequisites</h2>
        <h2>Step 1: Deploy CDN</h2>
        <h2>Step 2: Configure Assets</h2>
        <h2>Step 3: Use in Templates</h2>
      </article>
      <CdnQuickstartPageContent />
    </>
  );
}
