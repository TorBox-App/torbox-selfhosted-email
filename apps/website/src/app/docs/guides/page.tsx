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
    "In-depth guides for production access, domain verification, AWS setup, templates, workflows, and configuration presets.",
  openGraph: {
    title: "Guides | Wraps",
    description:
      "In-depth guides for production access, domain verification, AWS setup, templates, workflows, and configuration presets.",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <nav aria-hidden="true" className="sr-only">
        <h1>Wraps Guides</h1>
        <p>
          In-depth guides for production access, domain verification, and AWS
          setup.
        </p>
        <h2>Available Guides</h2>
        <ul>
          <li>AWS Setup - Configure your AWS account for Wraps</li>
          <li>Production Access - Get AWS SES production access approval</li>
          <li>Domain Verification - Set up DKIM, SPF, and DMARC</li>
          <li>Configuration Presets - Starter, Production, and Enterprise features and costs</li>
          <li>Templates as Code - Write email templates as React components</li>
          <li>Building Workflows - Automated email and SMS sequences</li>
        </ul>
      </nav>
      <GuidesPageContent />
    </>
  );
}
