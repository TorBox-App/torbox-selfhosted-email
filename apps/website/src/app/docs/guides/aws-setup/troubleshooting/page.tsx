import type { Metadata } from "next";
import TroubleshootingPageContent from "./page-content";

export const metadata: Metadata = {
  title: "AWS Troubleshooting",
  description: "Troubleshoot common AWS setup issues.",
  openGraph: {
    title: "AWS Troubleshooting | Wraps",
    description: "Troubleshoot common AWS setup issues.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/troubleshooting",
  },
  twitter: {
    title: "AWS Troubleshooting | Wraps",
    description: "Troubleshoot common AWS setup issues.",
  },
};

export default function TroubleshootingPage() {
  return <TroubleshootingPageContent />;
}
