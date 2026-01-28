import type { Metadata } from "next";
import CLIReferenceCdnPageContent from "./page-content";

export const metadata: Metadata = {
  title: "CDN CLI Commands",
  description: "CLI commands for managing CDN infrastructure.",
  openGraph: {
    title: "CDN CLI Commands | Wraps",
    description: "CLI commands for managing CDN infrastructure.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference/cdn",
  },
  twitter: {
    title: "CDN CLI Commands | Wraps",
    description: "CLI commands for managing CDN infrastructure.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/cli-reference/cdn",
  },
};

export default function CLIReferenceCdnPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>CDN CLI Commands</h1>
        <p>CLI commands for managing CDN infrastructure.</p>
        <h2>wraps cdn init</h2>
        <h2>wraps cdn status</h2>
        <h2>wraps cdn destroy</h2>
      </article>
      <CLIReferenceCdnPageContent />
    </>
  );
}
