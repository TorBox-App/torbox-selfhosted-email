import type { Metadata } from "next";
import DomainVerificationPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Domain Verification Guide",
  description: "Set up DKIM, SPF, and DMARC for your domain.",
  openGraph: {
    title: "Domain Verification Guide | Wraps",
    description: "Set up DKIM, SPF, and DMARC for your domain.",
    type: "website",
    url: "https://wraps.dev/docs/guides/domain-verification",
  },
  twitter: {
    title: "Domain Verification Guide | Wraps",
    description: "Set up DKIM, SPF, and DMARC for your domain.",
  },
};

export default function DomainVerificationPage() {
  return <DomainVerificationPageContent />;
}
