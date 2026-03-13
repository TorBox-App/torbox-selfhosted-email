import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
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
      name: "Cross-Channel Orchestration",
      item: "https://wraps.dev/docs/guides/orchestration",
    },
  ],
};

export const metadata: Metadata = {
  title: "Cross-Channel Orchestration",
  description:
    "Build cascading notification flows that try email first and fall back to SMS using the cascade() helper.",
  openGraph: {
    title: "Cross-Channel Orchestration | Wraps",
    description:
      "Build cascading notification flows that try email first and fall back to SMS using the cascade() helper.",
    type: "website",
    url: "https://wraps.dev/docs/guides/orchestration",
  },
  twitter: {
    title: "Cross-Channel Orchestration | Wraps",
    description:
      "Build cascading notification flows that try email first and fall back to SMS using the cascade() helper.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/orchestration",
  },
};

export default function OrchestrationPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>Cross-Channel Orchestration</h2>
        <p>
          Build cascading notification flows that try email first and fall back
          to SMS using the cascade() helper.
        </p>
        <h2>What is a Cascade?</h2>
        <h2>The cascade() Helper</h2>
        <h2>How It Works</h2>
        <h2>Examples</h2>
        <h2>Best Practices</h2>
      </article>
      <PageContent />
    </>
  );
}
