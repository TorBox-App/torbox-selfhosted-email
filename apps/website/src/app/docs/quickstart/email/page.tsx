import type { Metadata } from "next";
import EmailQuickstartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email Quickstart",
  description: "Send your first email with Wraps in under 2 minutes.",
  openGraph: {
    title: "Email Quickstart | Wraps",
    description: "Send your first email with Wraps in under 2 minutes.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/email",
  },
  twitter: {
    title: "Email Quickstart | Wraps",
    description: "Send your first email with Wraps in under 2 minutes.",
  },
};

export default function EmailQuickstartPage() {
  return <EmailQuickstartPageContent />;
}
