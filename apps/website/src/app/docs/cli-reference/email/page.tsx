import type { Metadata } from "next";
import CLIReferenceEmailPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email CLI Commands",
  description: "CLI commands for managing email infrastructure.",
  openGraph: {
    title: "Email CLI Commands | Wraps",
    description: "CLI commands for managing email infrastructure.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference/email",
  },
  twitter: {
    title: "Email CLI Commands | Wraps",
    description: "CLI commands for managing email infrastructure.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/cli-reference/email",
  },
};

export default function CLIReferenceEmailPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Email CLI Commands</h1>
        <p>CLI commands for managing email infrastructure.</p>
        <h2>wraps email init</h2>
        <h2>wraps email status</h2>
        <h2>wraps email domains</h2>
        <h2>wraps email upgrade</h2>
        <h2>wraps email destroy</h2>
      </article>
      <CLIReferenceEmailPageContent />
    </>
  );
}
