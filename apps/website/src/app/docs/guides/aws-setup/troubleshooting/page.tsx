import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import TroubleshootingPageContent from "./page-content";

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
      name: "AWS Setup",
      item: "https://wraps.dev/docs/guides/aws-setup",
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Troubleshooting",
      item: "https://wraps.dev/docs/guides/aws-setup/troubleshooting",
    },
  ],
};

export const metadata: Metadata = {
  title: "AWS Troubleshooting",
  description: "Troubleshoot common AWS setup issues.",
  openGraph: {
    title: "AWS Troubleshooting | Wraps",
    description: "Troubleshoot common AWS setup issues.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/troubleshooting",
  },
  twitter: {
    title: "AWS Troubleshooting | Wraps",
    description: "Troubleshoot common AWS setup issues.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/aws-setup/troubleshooting",
  },
};

export default function TroubleshootingPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>AWS Troubleshooting</h2>
        <p>Troubleshoot common AWS setup issues.</p>
      </article>
      <TroubleshootingPageContent />
    </>
  );
}
