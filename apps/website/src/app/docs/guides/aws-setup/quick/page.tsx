import type { Metadata } from "next";
import QuickStartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Quick AWS Setup",
  description: "Fast track AWS setup for Wraps.",
  openGraph: {
    title: "Quick AWS Setup | Wraps",
    description: "Fast track AWS setup for Wraps.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/quick",
  },
  twitter: {
    title: "Quick AWS Setup | Wraps",
    description: "Fast track AWS setup for Wraps.",
  },
};

export default function QuickStartPage() {
  return <QuickStartPageContent />;
}
