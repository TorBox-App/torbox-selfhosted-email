import type { Metadata } from "next";
import DocsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Get started with Wraps. Deploy production-ready email infrastructure to your AWS account in minutes.",
  openGraph: {
    title: "Documentation | Wraps",
    description:
      "Get started with Wraps. Deploy production-ready email infrastructure to your AWS account in minutes.",
    type: "website",
    url: "https://wraps.dev/docs",
  },
  twitter: {
    title: "Documentation | Wraps",
    description:
      "Get started with Wraps. Deploy production-ready email infrastructure to your AWS account in minutes.",
  },
};

export default function DocsPage() {
  return <DocsPageContent />;
}
