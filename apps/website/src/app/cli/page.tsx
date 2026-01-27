import type { Metadata } from "next";
import Script from "next/script";
import CliPageContent from "./page-content";

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Wraps CLI",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Linux, Windows",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Free, open-source CLI to deploy email infrastructure to your AWS account. One command deploys everything.",
  url: "https://wraps.dev/cli",
  downloadUrl: "https://www.npmjs.com/package/@wraps.dev/cli",
  softwareVersion: "1.0.0",
  author: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
  },
  license: "https://opensource.org/licenses/AGPL-3.0",
  programmingLanguage: "TypeScript",
};

export const metadata: Metadata = {
  title: "CLI & SDK",
  description:
    "Free, open-source CLI and SDK to deploy email infrastructure to your AWS account. One command deploys everything.",
  openGraph: {
    title: "CLI & SDK | Wraps",
    description:
      "Free, open-source CLI and SDK to deploy email infrastructure to your AWS account. One command deploys everything.",
    images: [
      {
        url: "/wraps-cli-og.png",
        width: 1424,
        height: 752,
        alt: "Wraps CLI - Deploy email infrastructure with one command",
      },
    ],
  },
  twitter: {
    title: "CLI & SDK | Wraps",
    description:
      "Free, open-source CLI and SDK to deploy email infrastructure to your AWS account. One command deploys everything.",
    images: ["/wraps-cli-og.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/cli",
  },
};

export default function CliPage() {
  return (
    <>
      <Script
        id="software-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Wraps CLI & SDK</h1>
        <p>
          Free, open-source CLI and SDK to deploy email infrastructure to your
          AWS account. One command deploys everything.
        </p>
        <h2>Installation</h2>
        <h2>Quick Start</h2>
        <h2>Features</h2>
        <h2>TypeScript SDK</h2>
      </article>
      <CliPageContent />
    </>
  );
}
