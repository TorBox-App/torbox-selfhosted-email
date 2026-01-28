import type { Metadata } from "next";
import SmsQuickstartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS Quickstart",
  description: "Send SMS messages through AWS with the Wraps SMS SDK.",
  openGraph: {
    title: "SMS Quickstart | Wraps",
    description: "Send SMS messages through AWS with the Wraps SMS SDK.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/sms",
  },
  twitter: {
    title: "SMS Quickstart | Wraps",
    description: "Send SMS messages through AWS with the Wraps SMS SDK.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/quickstart/sms",
  },
};

export default function SmsQuickstartPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>SMS Quickstart</h1>
        <p>Send SMS messages through AWS with the Wraps SMS SDK.</p>
        <h2>Prerequisites</h2>
        <h2>Step 1: Deploy Infrastructure</h2>
        <h2>Step 2: Install SDK</h2>
        <h2>Step 3: Send Your First SMS</h2>
      </article>
      <SmsQuickstartPageContent />
    </>
  );
}
