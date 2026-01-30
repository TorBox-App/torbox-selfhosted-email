import type { Metadata } from "next";
import SPFBuilderPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SPF Record Builder",
  description:
    "Build and validate your SPF record. Avoid the 10-lookup limit with our interactive tool.",
  openGraph: {
    title: "SPF Record Builder | Wraps",
    description:
      "Build and validate your SPF record. Avoid the 10-lookup limit with our interactive tool.",
  },
  twitter: {
    title: "SPF Record Builder | Wraps",
    description:
      "Build and validate your SPF record. Avoid the 10-lookup limit with our interactive tool.",
  },
  alternates: {
    canonical: "https://wraps.dev/tools/spf-builder",
  },
};

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SPF Record Builder",
  description:
    "Interactive tool to build and validate SPF records while tracking the 10-lookup limit. Select email providers and generate correct SPF syntax.",
  url: "https://wraps.dev/tools/spf-builder",
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
    "Real-time DNS lookup counter",
    "Pre-configured email provider includes",
    "Custom IP address support",
    "SPF syntax validation",
    "Copy-to-clipboard functionality",
  ],
};

export default function SPFBuilderPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        type="application/ld+json"
      />
      <SPFBuilderPageContent />
    </>
  );
}
