import type { Metadata } from "next";
import PlatformQuickstartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Platform Quickstart",
  description:
    "Get started with the Wraps Platform for contacts and broadcasts.",
  openGraph: {
    title: "Platform Quickstart | Wraps",
    description:
      "Get started with the Wraps Platform for contacts and broadcasts.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/platform",
  },
  twitter: {
    title: "Platform Quickstart | Wraps",
    description:
      "Get started with the Wraps Platform for contacts and broadcasts.",
  },
};

export default function PlatformQuickstartPage() {
  return <PlatformQuickstartPageContent />;
}
