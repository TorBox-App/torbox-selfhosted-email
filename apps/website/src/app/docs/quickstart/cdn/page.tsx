import type { Metadata } from "next";
import CdnQuickstartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "CDN Quickstart",
  description: "Deploy a CDN for your email assets with Wraps.",
  openGraph: {
    title: "CDN Quickstart | Wraps",
    description: "Deploy a CDN for your email assets with Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/cdn",
  },
  twitter: {
    title: "CDN Quickstart | Wraps",
    description: "Deploy a CDN for your email assets with Wraps.",
  },
};

export default function CdnQuickstartPage() {
  return <CdnQuickstartPageContent />;
}
