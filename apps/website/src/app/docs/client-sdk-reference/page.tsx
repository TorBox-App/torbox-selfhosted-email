import type { Metadata } from "next";
import ClientSDKReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "Platform SDK Reference",
  description: "Complete reference for @wraps.dev/client Platform API SDK.",
  openGraph: {
    title: "Platform SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/client Platform API SDK.",
    type: "website",
    url: "https://wraps.dev/docs/client-sdk-reference",
  },
  twitter: {
    title: "Platform SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/client Platform API SDK.",
  },
};

export default function ClientSDKReferencePage() {
  return <ClientSDKReferencePageContent />;
}
