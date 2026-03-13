import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import CDKReferencePageContent from "./page-content";

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
      name: "CDK Construct",
      item: "https://wraps.dev/docs/cdk-reference",
    },
  ],
};

export const metadata: Metadata = {
  title: "CDK Construct Reference",
  description: "Deploy Wraps infrastructure with AWS CDK.",
  openGraph: {
    title: "CDK Construct Reference | Wraps",
    description: "Deploy Wraps infrastructure with AWS CDK.",
    type: "website",
    url: "https://wraps.dev/docs/cdk-reference",
  },
  twitter: {
    title: "CDK Construct Reference | Wraps",
    description: "Deploy Wraps infrastructure with AWS CDK.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/cdk-reference",
  },
};

export default function CDKReferencePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>CDK Construct Reference</h2>
        <p>Deploy Wraps infrastructure with AWS CDK.</p>
        <h2>Installation</h2>
        <h2>Usage</h2>
        <h2>Configuration Options</h2>
      </article>
      <CDKReferencePageContent />
    </>
  );
}
