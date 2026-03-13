import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import VercelSetupPageContent from "./page-content";

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
      name: "Vercel Setup",
      item: "https://wraps.dev/docs/guides/vercel-setup",
    },
  ],
};

export const metadata: Metadata = {
  title: "Vercel Setup Guide",
  description:
    "Deploy email infrastructure with Vercel OIDC federation. Zero stored credentials, automatic rotation, and seamless Vercel integration.",
  openGraph: {
    title: "Vercel Setup Guide | Wraps",
    description:
      "Deploy email infrastructure with Vercel OIDC federation. Zero stored credentials, automatic rotation, and seamless Vercel integration.",
    type: "website",
    url: "https://wraps.dev/docs/guides/vercel-setup",
  },
  twitter: {
    title: "Vercel Setup Guide | Wraps",
    description: "Deploy email infrastructure with Vercel OIDC federation.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/vercel-setup",
  },
};

export default function VercelSetupPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h2>Vercel Setup Guide</h2>
        <p>Deploy email infrastructure with Vercel OIDC federation.</p>
        <h2>Overview</h2>
        <h2>Prerequisites</h2>
        <h2>Step 1: Deploy with Vercel Provider</h2>
        <h2>Step 2: Environment Variables</h2>
        <h2>Step 3: Configure DNS</h2>
        <h2>How OIDC Works</h2>
        <h2>Troubleshooting</h2>
        <h2>Next Steps</h2>
      </article>
      <VercelSetupPageContent />
    </>
  );
}
