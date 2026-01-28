import type { Metadata } from "next";
import Script from "next/script";
import DocsPageContent from "./page-content";

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
  ],
};

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Get started with Wraps. Deploy production-ready email infrastructure to your AWS account in minutes.",
  openGraph: {
    title: "Documentation | Wraps",
    description:
      "Get started with Wraps. Deploy production-ready email infrastructure to your AWS account in minutes.",
    type: "website",
    url: "https://wraps.dev/docs",
  },
  twitter: {
    title: "Documentation | Wraps",
    description:
      "Get started with Wraps. Deploy production-ready email infrastructure to your AWS account in minutes.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs",
  },
};

export default function DocsPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO - visually hidden but accessible to crawlers */}
      <nav aria-hidden="true" className="sr-only">
        <h1>Wraps Documentation</h1>
        <p>
          Deploy production-ready email infrastructure to your AWS account in
          minutes. Learn how to use the CLI, SDK, and console.
        </p>
        <h2>Documentation Sections</h2>
        <ul>
          <li>Quickstart - Deploy your first email infrastructure</li>
          <li>Platform SDK - Type-safe API client for contacts and batches</li>
          <li>Email SDK - Learn how to use @wraps.dev/email</li>
          <li>SMS SDK - Send SMS with @wraps.dev/sms</li>
          <li>CDK Construct - Deploy with AWS CDK</li>
          <li>Pulumi Component - Deploy with Pulumi</li>
          <li>CLI Commands - Complete CLI reference</li>
          <li>Guides - Production access, domain verification, and more</li>
        </ul>
      </nav>
      <DocsPageContent />
    </>
  );
}
