import type { Metadata } from "next";
import QuickstartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Deploy your first email infrastructure in 2 minutes with the Wraps CLI.",
  openGraph: {
    title: "Quickstart | Wraps",
    description:
      "Deploy your first email infrastructure in 2 minutes with the Wraps CLI.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart",
  },
  twitter: {
    title: "Quickstart | Wraps",
    description:
      "Deploy your first email infrastructure in 2 minutes with the Wraps CLI.",
  },
};

export default function QuickstartPage() {
  return <QuickstartPageContent />;
}
