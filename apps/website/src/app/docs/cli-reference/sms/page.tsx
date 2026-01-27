import type { Metadata } from "next";
import CLIReferenceSMSPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS CLI Commands",
  description: "CLI commands for managing SMS infrastructure.",
  openGraph: {
    title: "SMS CLI Commands | Wraps",
    description: "CLI commands for managing SMS infrastructure.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference/sms",
  },
  twitter: {
    title: "SMS CLI Commands | Wraps",
    description: "CLI commands for managing SMS infrastructure.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/cli-reference/sms",
  },
};

export default function CLIReferenceSMSPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>SMS CLI Commands</h1>
        <p>CLI commands for managing SMS infrastructure.</p>
        <h2>wraps sms init</h2>
        <h2>wraps sms status</h2>
        <h2>wraps sms destroy</h2>
      </article>
      <CLIReferenceSMSPageContent />
    </>
  );
}
