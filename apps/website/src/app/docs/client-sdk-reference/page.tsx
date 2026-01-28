import type { Metadata } from "next";
import ClientSDKReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "Platform SDK Reference",
  description: "Complete reference for @wraps.dev/client Platform API SDK.",
  openGraph: {
    title: "Platform SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/client Platform API SDK.",
    type: "website",
    url: "https://wraps.dev/docs/client-sdk-reference",
  },
  twitter: {
    title: "Platform SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/client Platform API SDK.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/client-sdk-reference",
  },
};

export default function ClientSDKReferencePage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Platform SDK Reference</h1>
        <p>Complete reference for @wraps.dev/client Platform API SDK.</p>
        <h2>Installation</h2>
        <h2>Authentication</h2>
        <h2>Contacts API</h2>
        <h2>Broadcasts API</h2>
        <h2>Batches API</h2>
        <h2>Error Handling</h2>
      </article>
      <ClientSDKReferencePageContent />
    </>
  );
}
