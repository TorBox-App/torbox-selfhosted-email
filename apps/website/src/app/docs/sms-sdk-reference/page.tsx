import type { Metadata } from "next";
import SMSSDKReferencePageContent from "./page-content";

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
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>SMS SDK Reference</h1>
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
