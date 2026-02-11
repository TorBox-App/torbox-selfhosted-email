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
      name: "Reference",
      item: "https://wraps.dev/docs/reference",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Environment Variables",
      item: "https://wraps.dev/docs/reference/environment-variables",
    },
  ],
};

export const metadata: Metadata = {
  title: "Environment Variables",
  description:
    "All environment variables used by the Wraps CLI and SDKs, including AWS credentials, DNS automation, and CI/CD configuration.",
  openGraph: {
    title: "Environment Variables | Wraps",
    description:
      "All environment variables used by the Wraps CLI and SDKs, including AWS credentials, DNS automation, and CI/CD configuration.",
    type: "website",
    url: "https://wraps.dev/docs/reference/environment-variables",
  },
  twitter: {
    title: "Environment Variables | Wraps",
    description:
      "All environment variables used by the Wraps CLI and SDKs, including AWS credentials, DNS automation, and CI/CD configuration.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/reference/environment-variables",
  },
};

export default function EnvironmentVariablesPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Environment Variables</h1>
        <p>All environment variables used by the Wraps CLI and SDKs.</p>
        <h2>Wraps Configuration</h2>
        <h2>AWS Credentials</h2>
        <h2>DNS Automation</h2>
        <h2>Pulumi (Internal)</h2>
        <h2>CI/CD Examples</h2>
        <h2>Next Steps</h2>
      </article>
      <PageContent />
    </>
  );
}
