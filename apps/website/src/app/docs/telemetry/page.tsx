import type { Metadata } from "next";
import Script from "next/script";
import TelemetryPageContent from "./page-content";

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
      name: "Telemetry",
      item: "https://wraps.dev/docs/telemetry",
    },
  ],
};

export const metadata: Metadata = {
  title: "Telemetry",
  description: "Learn about Wraps CLI telemetry and how to opt out.",
  openGraph: {
    title: "Telemetry | Wraps",
    description: "Learn about Wraps CLI telemetry and how to opt out.",
    type: "website",
    url: "https://wraps.dev/docs/telemetry",
  },
  twitter: {
    title: "Telemetry | Wraps",
    description: "Learn about Wraps CLI telemetry and how to opt out.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/telemetry",
  },
};

export default function TelemetryPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Telemetry</h1>
        <p>Learn about Wraps CLI telemetry and how to opt out.</p>
      </article>
      <TelemetryPageContent />
    </>
  );
}
