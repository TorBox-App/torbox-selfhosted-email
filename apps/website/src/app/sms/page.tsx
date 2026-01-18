import type { Metadata } from "next";
import SmsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS Infrastructure",
  description:
    "Coming soon: Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  openGraph: {
    title: "SMS Infrastructure | Wraps",
    description:
      "Coming soon: Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  },
  twitter: {
    title: "SMS Infrastructure | Wraps",
    description:
      "Coming soon: Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  },
};

export default function SmsPage() {
  return <SmsPageContent />;
}
