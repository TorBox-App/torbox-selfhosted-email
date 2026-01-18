import type { Metadata } from "next";
import AWSSetupPageContent from "./page-content";

export const metadata: Metadata = {
  title: "AWS Setup Guide",
  description: "Configure your AWS account for Wraps.",
  openGraph: {
    title: "AWS Setup Guide | Wraps",
    description: "Configure your AWS account for Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup",
  },
  twitter: {
    title: "AWS Setup Guide | Wraps",
    description: "Configure your AWS account for Wraps.",
  },
};

export default function AWSSetupPage() {
  return <AWSSetupPageContent />;
}
