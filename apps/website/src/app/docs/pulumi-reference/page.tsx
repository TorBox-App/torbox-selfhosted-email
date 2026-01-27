import type { Metadata } from "next";
import PulumiReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "Pulumi Component Reference",
  description: "Deploy Wraps infrastructure with Pulumi.",
  openGraph: {
    title: "Pulumi Component Reference | Wraps",
    description: "Deploy Wraps infrastructure with Pulumi.",
    type: "website",
    url: "https://wraps.dev/docs/pulumi-reference",
  },
  twitter: {
    title: "Pulumi Component Reference | Wraps",
    description: "Deploy Wraps infrastructure with Pulumi.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/pulumi-reference",
  },
};

export default function PulumiReferencePage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Pulumi Component Reference</h1>
        <p>Deploy Wraps infrastructure with Pulumi.</p>
        <h2>Installation</h2>
        <h2>Usage</h2>
        <h2>Configuration Options</h2>
      </article>
      <PulumiReferencePageContent />
    </>
  );
}
