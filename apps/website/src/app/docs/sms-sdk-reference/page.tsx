import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import SMSSDKReferencePageContent from "./page-content";

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
      name: "SMS SDK",
      item: "https://wraps.dev/docs/sms-sdk-reference",
    },
  ],
};

export const metadata: Metadata = {
  title: "SMS SDK Reference",
  description: "Complete reference for @wraps.dev/sms TypeScript SDK.",
  openGraph: {
    title: "SMS SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/sms TypeScript SDK.",
    type: "website",
    url: "https://wraps.dev/docs/sms-sdk-reference",
  },
  twitter: {
    title: "SMS SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/sms TypeScript SDK.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/sms-sdk-reference",
  },
};

export default function SMSSDKReferencePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>SMS SDK Reference</h2>
        <p>Complete reference for @wraps.dev/sms TypeScript SDK.</p>
        <h2>Installation</h2>
        <h2>Configuration</h2>
        <h2>Sending SMS</h2>
        <h2>Opt-out Management</h2>
        <h2>Error Handling</h2>
      </article>
      <SMSSDKReferencePageContent />
    </>
  );
}
