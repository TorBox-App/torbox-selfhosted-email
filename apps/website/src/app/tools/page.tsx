import type { Metadata } from "next";
import ToolsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email Tools",
  description:
    "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  openGraph: {
    title: "Email Tools | Wraps",
    description:
      "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  },
  twitter: {
    title: "Email Tools | Wraps",
    description:
      "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  },
};

export default function ToolsPage() {
  return <ToolsPageContent />;
}
