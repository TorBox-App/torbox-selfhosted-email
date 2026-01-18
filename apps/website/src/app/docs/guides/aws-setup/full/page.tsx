import type { Metadata } from "next";
import FullGuidePageContent from "./page-content";

export const metadata: Metadata = {
  title: "Full AWS Setup",
  description: "Complete AWS setup guide for Wraps.",
  openGraph: {
    title: "Full AWS Setup | Wraps",
    description: "Complete AWS setup guide for Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/full",
  },
  twitter: {
    title: "Full AWS Setup | Wraps",
    description: "Complete AWS setup guide for Wraps.",
  },
};

export default function FullGuidePage() {
  return <FullGuidePageContent />;
}
