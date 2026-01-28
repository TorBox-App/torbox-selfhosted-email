import type { Metadata } from "next";
import TroubleshootingPageContent from "./page-content";

export const metadata: Metadata = {
  title: "AWS Troubleshooting",
  description: "Troubleshoot common AWS setup issues.",
  openGraph: {
    title: "AWS Troubleshooting | Wraps",
    description: "Troubleshoot common AWS setup issues.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/troubleshooting",
  },
  twitter: {
    title: "AWS Troubleshooting | Wraps",
    description: "Troubleshoot common AWS setup issues.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/aws-setup/troubleshooting",
  },
};

export default function TroubleshootingPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>AWS Troubleshooting</h1>
        <p>Troubleshoot common AWS setup issues.</p>
      </article>
      <TroubleshootingPageContent />
    </>
  );
}
