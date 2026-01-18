import type { Metadata } from "next";
import SmsQuickstartPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS Quickstart",
  description: "Send SMS messages through AWS with the Wraps SMS SDK.",
  openGraph: {
    title: "SMS Quickstart | Wraps",
    description: "Send SMS messages through AWS with the Wraps SMS SDK.",
    type: "website",
    url: "https://wraps.dev/docs/quickstart/sms",
  },
  twitter: {
    title: "SMS Quickstart | Wraps",
    description: "Send SMS messages through AWS with the Wraps SMS SDK.",
  },
};

export default function SmsQuickstartPage() {
  return <SmsQuickstartPageContent />;
}
