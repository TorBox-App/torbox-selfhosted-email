import type { Metadata } from "next";
import Script from "next/script";
import DomainVerificationPageContent from "./page-content";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Docs", item: "https://wraps.dev/docs" },
    { "@type": "ListItem", position: 2, name: "Guides", item: "https://wraps.dev/docs/guides" },
    { "@type": "ListItem", position: 3, name: "Domain Verification", item: "https://wraps.dev/docs/guides/domain-verification" },
  ],
};

export const metadata: Metadata = {
  title: "Domain Verification Guide",
  description: "Set up DKIM, SPF, and DMARC for your domain.",
  openGraph: {
    title: "Domain Verification Guide | Wraps",
    description: "Set up DKIM, SPF, and DMARC for your domain.",
    type: "website",
    url: "https://wraps.dev/docs/guides/domain-verification",
  },
  twitter: {
    title: "Domain Verification Guide | Wraps",
    description: "Set up DKIM, SPF, and DMARC for your domain.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/domain-verification",
  },
};

export default function DomainVerificationPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Domain Verification Guide</h1>
        <p>Set up DKIM, SPF, and DMARC for your domain.</p>
        <h2>DKIM Setup</h2>
        <h2>SPF Configuration</h2>
        <h2>DMARC Policy</h2>
        <h2>DNS Providers</h2>
      </article>
      <DomainVerificationPageContent />
    </>
  );
}
