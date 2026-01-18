import type { Metadata } from "next";
import SDKReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email SDK Reference",
  description: "Complete reference for @wraps.dev/email TypeScript SDK.",
  openGraph: {
    title: "Email SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/email TypeScript SDK.",
    type: "website",
    url: "https://wraps.dev/docs/sdk-reference",
  },
  twitter: {
    title: "Email SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/email TypeScript SDK.",
  },
};

export default function SDKReferencePage() {
  return <SDKReferencePageContent />;
}
