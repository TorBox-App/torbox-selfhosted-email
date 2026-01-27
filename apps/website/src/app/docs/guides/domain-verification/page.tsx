import type { Metadata } from "next";
import DomainVerificationPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Domain Verification Guide",
  description: "Set up DKIM, SPF, and DMARC for your domain.",
  openGraph: {
    title: "Domain Verification Guide | Wraps",
    description: "Set up DKIM, SPF, and DMARC for your domain.",
    type: "website",
    url: "https://wraps.dev/docs/guides/domain-verification",
  },
  twitter: {
    title: "Domain Verification Guide | Wraps",
    description: "Set up DKIM, SPF, and DMARC for your domain.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/domain-verification",
  },
};

export default function DomainVerificationPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Domain Verification Guide</h1>
        <p>Set up DKIM, SPF, and DMARC for your domain.</p>
        <h2>DKIM Setup</h2>
        <h2>SPF Configuration</h2>
        <h2>DMARC Policy</h2>
        <h2>DNS Providers</h2>
      </article>
      <DomainVerificationPageContent />
    </>
  );
}
