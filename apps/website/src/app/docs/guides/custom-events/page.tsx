import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import CustomEventsPageContent from "./page-content";

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
      name: "Custom Events",
      item: "https://wraps.dev/docs/guides/custom-events",
    },
  ],
};

export const metadata: Metadata = {
  title: "Custom Events",
  description:
    "Emit custom events from your application to trigger workflows, track user behavior, and resume waiting automation steps using the @wraps.dev/client SDK.",
  openGraph: {
    title: "Custom Events | Wraps",
    description:
      "Emit custom events from your application to trigger workflows, track user behavior, and resume waiting automation steps using the @wraps.dev/client SDK.",
    type: "website",
    url: "https://wraps.dev/docs/guides/custom-events",
  },
  twitter: {
    title: "Custom Events | Wraps",
    description:
      "Emit custom events from your application to trigger workflows and track user behavior using the @wraps.dev/client SDK.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/custom-events",
  },
};

export default function CustomEventsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>Custom Events</h2>
        <p>
          Emit custom events from your application to trigger workflows, track
          user behavior, and resume waiting automation steps.
        </p>
        <h2>Overview</h2>
        <h2>Sending an Event</h2>
        <h2>Track Options</h2>
        <h2>Auto-Creating Contacts</h2>
        <h2>Batch Events</h2>
        <h2>Triggering Workflows</h2>
        <h2>Resuming Waiting Steps</h2>
        <h2>Event Limits</h2>
        <h2>Examples</h2>
      </article>
      <CustomEventsPageContent />
    </>
  );
}
