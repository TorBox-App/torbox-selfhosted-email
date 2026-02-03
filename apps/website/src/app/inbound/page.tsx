import type { Metadata } from "next";
import Script from "next/script";
import InboundPageContent from "./page-content";

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Wraps Inbound Email",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "AWS",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Receive and process inbound emails in your AWS account. Parse headers, extract attachments, detect spam, and trigger webhooks with EventBridge.",
  url: "https://wraps.dev/inbound",
  author: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
  },
  programmingLanguage: "TypeScript",
};

export const metadata: Metadata = {
  title: "Inbound Email - Receive Emails in Your AWS | Wraps",
  description:
    "Receive and process emails in your AWS account. Parse headers, extract attachments, detect spam, and trigger webhooks with EventBridge.",
  openGraph: {
    title: "Inbound Email | Wraps",
    description:
      "Receive emails in your AWS with EventBridge webhooks. Full parsing, attachments, and threading support.",
    images: [
      {
        url: "/blog/wraps-inbound-og.png",
        width: 1200,
        height: 630,
        alt: "Wraps Inbound Email - Receive and process emails in your AWS",
      },
    ],
  },
  twitter: {
    title: "Inbound Email | Wraps",
    description:
      "Receive emails in your AWS with EventBridge webhooks. Full parsing, attachments, and threading support.",
    images: ["/blog/wraps-inbound-og.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/inbound",
  },
};

export default function InboundPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        id="software-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Inbound Email - Receive Emails in Your AWS</h1>
        <p>
          Receive and process inbound emails in your AWS account. Parse headers,
          extract attachments, detect spam, and trigger webhooks with
          EventBridge.
        </p>
        <h2>Email Pipeline</h2>
        <p>SES receives emails and stores them in S3</p>
        <p>Lambda parses emails and publishes events to EventBridge</p>
        <p>Build webhooks and automations with real-time triggers</p>
        <h2>SDK Features</h2>
        <p>List, read, reply, and forward emails programmatically</p>
        <p>Threading headers preserved for proper email chains</p>
        <h2>Use Cases</h2>
        <p>Support inbox, order processing, email-to-ticket workflows</p>
      </article>
      <InboundPageContent />
    </>
  );
}
