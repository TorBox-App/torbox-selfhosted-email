import type { Metadata } from "next";
import ToolsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email Tools",
  description:
    "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  openGraph: {
    title: "Email Tools | Wraps",
    description:
      "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  },
  twitter: {
    title: "Email Tools | Wraps",
    description:
      "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  },
  alternates: {
    canonical: "https://wraps.dev/tools",
  },
};

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Wraps Email Deliverability Checker",
  description:
    "Free tools to check your email deliverability setup including DMARC analyzer, SPF validator, DKIM checker, and domain reputation tools.",
  url: "https://wraps.dev/tools",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  provider: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
  },
  featureList: [
    "DMARC policy analyzer",
    "SPF record validator",
    "DKIM signature checker",
    "Domain reputation check",
    "MX record verification",
  ],
};

export default function ToolsPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        suppressHydrationWarning
        type="application/ld+json"
      />
      <h1 className="sr-only">Email Deliverability Checker</h1>
      <ToolsPageContent />
    </>
  );
}
