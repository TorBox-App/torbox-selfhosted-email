import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import BetterAuthPageContent from "./page-content";

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
      name: "Better Auth",
      item: "https://wraps.dev/docs/guides/better-auth",
    },
  ],
};

export const metadata: Metadata = {
  title: "Better Auth",
  description:
    "Sync Better Auth signups to Wraps contacts and send verification, password reset, magic link, OTP, and invitation emails from your own AWS SES account.",
  openGraph: {
    title: "Better Auth | Wraps",
    description:
      "Sync Better Auth signups to Wraps contacts and send auth emails from your own AWS SES account with the @wraps.dev/better-auth plugin.",
    type: "website",
    url: "https://wraps.dev/docs/guides/better-auth",
  },
  twitter: {
    title: "Better Auth | Wraps",
    description:
      "Sync Better Auth signups to Wraps contacts and send auth emails from your own AWS SES account.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/better-auth",
  },
};

export default function BetterAuthPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Better Auth</h1>
        <p>
          Sync Better Auth signups to Wraps contacts and send verification,
          password reset, magic link, OTP, and invitation emails from your own
          AWS SES account.
        </p>
        <h2>Installation</h2>
        <h2>Quick Start</h2>
        <h2>Auth Emails</h2>
        <h2>Contact Sync</h2>
        <h2>Consent and Topics</h2>
        <h2>Options</h2>
        <h2>Serverless and waitUntil</h2>
        <h2>Error Handling</h2>
      </article>
      <BetterAuthPageContent />
    </>
  );
}
