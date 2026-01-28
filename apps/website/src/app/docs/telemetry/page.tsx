import type { Metadata } from "next";
import TelemetryPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Telemetry",
  description: "Learn about Wraps CLI telemetry and how to opt out.",
  openGraph: {
    title: "Telemetry | Wraps",
    description: "Learn about Wraps CLI telemetry and how to opt out.",
    type: "website",
    url: "https://wraps.dev/docs/telemetry",
  },
  twitter: {
    title: "Telemetry | Wraps",
    description: "Learn about Wraps CLI telemetry and how to opt out.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/telemetry",
  },
};

export default function TelemetryPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Telemetry</h1>
        <p>Learn about Wraps CLI telemetry and how to opt out.</p>
      </article>
      <TelemetryPageContent />
    </>
  );
}
