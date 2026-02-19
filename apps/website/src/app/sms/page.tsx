import type { Metadata } from "next";
import SmsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS Infrastructure",
  description:
    "Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  openGraph: {
    title: "SMS Infrastructure | Wraps",
    description:
      "Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  },
  twitter: {
    title: "SMS Infrastructure | Wraps",
    description:
      "Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  },
  alternates: {
    canonical: "https://wraps.dev/sms",
  },
};

export default function SmsPage() {
  return (
    <>
      <SmsPageContent />
    </>
  );
}
