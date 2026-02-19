import type { Metadata } from "next";
import Script from "next/script";
import InboundEmailQuickstartPageContent from "./page-content";

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
    {
      "@type": "ListItem",
      position: 4,
      name: "Inbound Email",
      item: "https://wraps.dev/docs/quickstart/email/inbound",
    },
  ],
};

export const metadata: Metadata = {
  title: "Inbound Email Quickstart",
  description:
    "Set up inbound email receiving with AWS SES in under 5 minutes. Parse incoming emails, extract attachments, and build automated workflows.",
  openGraph: {
    title: "Inbound Email Quickstart | Wraps",
    description:
      "Set up inbound email receiving with AWS SES in under 5 minutes. Parse incoming emails, extract attachments, and build automated workflows.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/email/inbound",
  },
  twitter: {
    title: "Inbound Email Quickstart | Wraps",
    description:
      "Set up inbound email receiving with AWS SES in under 5 minutes.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/quickstart/email/inbound",
  },
};

export default function InboundEmailQuickstartPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      <article aria-hidden="true" className="sr-only">
        <h2>Inbound Email Quickstart</h2>
        <p>
          Set up inbound email receiving with AWS SES in under 5 minutes. Parse
          incoming emails, extract attachments, and build automated workflows.
        </p>
        <h2>Deploy Inbound Infrastructure</h2>
        <h2>Configure DNS (MX Record)</h2>
        <h2>Install the SDK</h2>
        <h2>Read Inbound Emails</h2>
        <h2>Reply and Forward Emails</h2>
        <h2>View in Dashboard</h2>
        <h2>Listen to EventBridge Events</h2>
        <h2>Next Steps</h2>
      </article>
      <InboundEmailQuickstartPageContent />
    </>
  );
}
