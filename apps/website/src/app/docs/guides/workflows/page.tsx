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
      name: "Guides",
      item: "https://wraps.dev/docs/guides",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Building Workflows",
      item: "https://wraps.dev/docs/guides/workflows",
    },
  ],
};

export const metadata: Metadata = {
  title: "Building Workflows",
  description:
    "Create automated email and SMS sequences using the Wraps workflow DSL.",
  openGraph: {
    title: "Building Workflows | Wraps",
    description:
      "Create automated email and SMS sequences using the Wraps workflow DSL.",
    type: "website",
    url: "https://wraps.dev/docs/guides/workflows",
  },
  twitter: {
    title: "Building Workflows | Wraps",
    description:
      "Create automated email and SMS sequences using the Wraps workflow DSL.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/workflows",
  },
};

export default function WorkflowsPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Building Workflows</h1>
        <p>
          Create automated email and SMS sequences using the Wraps workflow DSL.
        </p>
        <h2>Defining a Workflow</h2>
        <h2>Trigger Types</h2>
        <h2>Step Helpers</h2>
        <h2>Validate and Push</h2>
        <h2>Re-engagement Example</h2>
      </article>
      <PageContent />
    </>
  );
}
