import type { Metadata } from "next";
import CLIReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "CLI Reference",
  description: "Complete reference for all Wraps CLI commands.",
  openGraph: {
    title: "CLI Reference | Wraps",
    description: "Complete reference for all Wraps CLI commands.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference",
  },
  twitter: {
    title: "CLI Reference | Wraps",
    description: "Complete reference for all Wraps CLI commands.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/cli-reference",
  },
};

export default function CLIReferencePage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Wraps CLI Reference</h1>
        <p>Complete reference for all Wraps CLI commands.</p>
        <h2>Installation</h2>
        <h2>Email Commands</h2>
        <h2>SMS Commands</h2>
        <h2>CDN Commands</h2>
        <h2>Platform Commands</h2>
      </article>
      <CLIReferencePageContent />
    </>
  );
}
