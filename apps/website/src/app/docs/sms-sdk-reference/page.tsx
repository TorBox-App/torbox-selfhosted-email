import type { Metadata } from "next";
import SMSSDKReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS SDK Reference",
  description: "Complete reference for @wraps.dev/sms TypeScript SDK.",
  openGraph: {
    title: "SMS SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/sms TypeScript SDK.",
    type: "website",
    url: "https://wraps.dev/docs/sms-sdk-reference",
  },
  twitter: {
    title: "SMS SDK Reference | Wraps",
    description: "Complete reference for @wraps.dev/sms TypeScript SDK.",
  },
};

export default function SMSSDKReferencePage() {
  return <SMSSDKReferencePageContent />;
}
