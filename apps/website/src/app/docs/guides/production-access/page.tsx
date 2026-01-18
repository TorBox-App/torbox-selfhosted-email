import type { Metadata } from "next";
import ProductionAccessPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Production Access Guide",
  description: "How to get AWS SES production access approval.",
  openGraph: {
    title: "Production Access Guide | Wraps",
    description: "How to get AWS SES production access approval.",
    type: "website",
    url: "https://wraps.dev/docs/guides/production-access",
  },
  twitter: {
    title: "Production Access Guide | Wraps",
    description: "How to get AWS SES production access approval.",
  },
};

export default function ProductionAccessPage() {
  return <ProductionAccessPageContent />;
}
