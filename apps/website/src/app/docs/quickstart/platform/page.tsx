import type { Metadata } from "next";
import PlatformQuickstartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Platform Quickstart",
  description:
    "Get started with the Wraps Platform for contacts and broadcasts.",
  openGraph: {
    title: "Platform Quickstart | Wraps",
    description:
      "Get started with the Wraps Platform for contacts and broadcasts.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/platform",
  },
  twitter: {
    title: "Platform Quickstart | Wraps",
    description:
      "Get started with the Wraps Platform for contacts and broadcasts.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/quickstart/platform",
  },
};

export default function PlatformQuickstartPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Platform Quickstart</h1>
        <p>Get started with the Wraps Platform for contacts and broadcasts.</p>
        <h2>Prerequisites</h2>
        <h2>Step 1: Connect Your Account</h2>
        <h2>Step 2: Import Contacts</h2>
        <h2>Step 3: Create Your First Broadcast</h2>
      </article>
      <PlatformQuickstartPageContent />
    </>
  );
}
