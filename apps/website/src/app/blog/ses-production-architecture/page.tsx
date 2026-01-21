import type { Metadata } from "next";
import SESProductionArchitecture from "./page-content";

export const metadata: Metadata = {
  title: "AWS SES Production Architecture Guide",
  description:
    "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, configuration sets, and the patterns that protect your sender reputation.",
  openGraph: {
    title: "AWS SES Production Architecture Guide | Wraps",
    description:
      "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, and the patterns that protect your sender reputation.",
    type: "article",
    url: "https://wraps.dev/blog/ses-production-architecture",
    images: [
      {
        url: "https://wraps.dev/blog/ses-production-architecture.png",
        width: 1200,
        height: 630,
        alt: "AWS SES Production Architecture Guide",
      },
    ],
    publishedTime: "2026-01-21T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AWS SES Production Architecture Guide | Wraps",
    description:
      "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, and monitoring.",
    images: ["https://wraps.dev/blog/ses-production-architecture.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/ses-production-architecture",
  },
};

export default function Page() {
  return <SESProductionArchitecture />;
}
