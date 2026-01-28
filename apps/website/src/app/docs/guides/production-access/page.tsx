import type { Metadata } from "next";
import ProductionAccessPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Production Access Guide",
  description:
    "Step-by-step guide to getting AWS SES production access approval. Includes request templates, common rejection reasons, and best practices for approval.",
  openGraph: {
    title: "Production Access Guide | Wraps",
    description:
      "Step-by-step guide to getting AWS SES production access approval. Includes request templates and best practices.",
    type: "website",
    url: "https://wraps.dev/docs/guides/production-access",
  },
  twitter: {
    title: "Production Access Guide | Wraps",
    description:
      "Step-by-step guide to getting AWS SES production access approval. Includes templates and best practices.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/production-access",
  },
};

export default function ProductionAccessPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Production Access Guide</h1>
        <p>How to get AWS SES production access approval.</p>
        <h2>Prerequisites</h2>
        <h2>Request Process</h2>
        <h2>Common Rejection Reasons</h2>
        <h2>Best Practices</h2>
      </article>
      <ProductionAccessPageContent />
    </>
  );
}
