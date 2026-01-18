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
    images: [
      {
        url: "/wraps-cli-og.png",
        width: 1424,
        height: 752,
        alt: "Wraps CLI - Deploy email infrastructure with one command",
      },
    ],
  },
  twitter: {
    title: "CLI & SDK | Wraps",
    description:
      "Free, open-source CLI and SDK to deploy email infrastructure to your AWS account. One command deploys everything.",
    images: ["/wraps-cli-og.png"],
  },
};

export default function CliPage() {
  return <CliPageContent />;
}
