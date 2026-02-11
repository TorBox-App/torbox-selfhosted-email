import type { Metadata } from "next";
import Script from "next/script";
import PageContent from "./page-content";

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
      name: "Infrastructure",
      item: "https://wraps.dev/docs/infrastructure",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "CDN",
      item: "https://wraps.dev/docs/infrastructure/cdn",
    },
  ],
};

export const metadata: Metadata = {
  title: "What Gets Deployed: CDN",
  description:
    "Every AWS resource Wraps creates when you run wraps cdn init. Includes S3, CloudFront, ACM certificates, and IAM roles for hosting email assets and images.",
  openGraph: {
    title: "What Gets Deployed: CDN | Wraps",
    description:
      "Every AWS resource Wraps creates when you run wraps cdn init.",
    type: "website",
    url: "https://wraps.dev/docs/infrastructure/cdn",
  },
  twitter: {
    title: "What Gets Deployed: CDN | Wraps",
    description:
      "Every AWS resource Wraps creates when you run wraps cdn init.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/infrastructure/cdn",
  },
};

export default function InfrastructureCdnPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>What Gets Deployed: CDN</h1>
        <p>Every AWS resource Wraps creates when you run wraps cdn init.</p>
        <h2>Overview</h2>
        <h2>Core Resources</h2>
        <h2>Custom Domain Resources</h2>
        <h2>Cost Estimate</h2>
      </article>
      <PageContent />
    </>
  );
}
