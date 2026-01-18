import type { Metadata } from "next";
import CliPageContent from "./page-content";

export const metadata: Metadata = {
  title: "CLI & SDK",
  description:
    "Free, open-source CLI and SDK to deploy email infrastructure to your AWS account. One command deploys everything.",
  openGraph: {
    title: "CLI & SDK | Wraps",
    description:
      "Free, open-source CLI and SDK to deploy email infrastructure to your AWS account. One command deploys everything.",
  },
  twitter: {
    title: "CLI & SDK | Wraps",
    description:
      "Free, open-source CLI and SDK to deploy email infrastructure to your AWS account. One command deploys everything.",
  },
};

export default function CliPage() {
  return <CliPageContent />;
}
