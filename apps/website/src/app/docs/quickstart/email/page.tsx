import type { Metadata } from "next";
import Script from "next/script";
import EmailQuickstartPageContent from "./page-content";

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
      name: "Quickstart",
      item: "https://wraps.dev/docs/quickstart",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Email",
      item: "https://wraps.dev/docs/quickstart/email",
    },
  ],
};

export const metadata: Metadata = {
  title: "Email Quickstart",
  description: "Send your first email with Wraps in under 2 minutes.",
  openGraph: {
    title: "Email Quickstart | Wraps",
    description: "Send your first email with Wraps in under 2 minutes.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/email",
  },
  twitter: {
    title: "Email Quickstart | Wraps",
    description: "Send your first email with Wraps in under 2 minutes.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/quickstart/email",
  },
};

export default function EmailQuickstartPage() {
  return (
    <>
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Email Quickstart</h1>
        <p>Send your first email with Wraps in under 2 minutes.</p>
        <h2>Prerequisites</h2>
        <h2>Step 1: Deploy Infrastructure</h2>
        <h2>Step 2: Install SDK</h2>
        <h2>Step 3: Send Your First Email</h2>
      </article>
      <EmailQuickstartPageContent />
    </>
  );
}
