import type { Metadata } from "next";
import Script from "next/script";
import AWSSetupPageContent from "./page-content";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Docs", item: "https://wraps.dev/docs" },
    { "@type": "ListItem", position: 2, name: "Guides", item: "https://wraps.dev/docs/guides" },
    { "@type": "ListItem", position: 3, name: "AWS Setup", item: "https://wraps.dev/docs/guides/aws-setup" },
  ],
};

export const metadata: Metadata = {
  title: "AWS Setup Guide",
  description: "Configure your AWS account for Wraps.",
  openGraph: {
    title: "AWS Setup Guide | Wraps",
    description: "Configure your AWS account for Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup",
  },
  twitter: {
    title: "AWS Setup Guide | Wraps",
    description: "Configure your AWS account for Wraps.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/aws-setup",
  },
};

export default function AWSSetupPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>AWS Setup Guide</h1>
        <p>Configure your AWS account for Wraps.</p>
        <h2>Quick Setup</h2>
        <h2>Full Setup</h2>
        <h2>IAM Permissions</h2>
        <h2>Troubleshooting</h2>
      </article>
      <AWSSetupPageContent />
    </>
  );
}
