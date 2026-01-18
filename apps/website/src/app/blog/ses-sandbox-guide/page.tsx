import type { Metadata } from "next";
import SESSandboxGuide from "./page-content";

export const metadata: Metadata = {
  title: "How to Get Out of AWS SES Sandbox",
  description:
    "The complete guide to SES production access approval. Interactive checklists, request templates, and everything you need to escape the sandbox on your first try.",
  openGraph: {
    title: "How to Get Out of AWS SES Sandbox | Wraps",
    description:
      "The complete guide to SES production access approval. Interactive checklists, request templates, and everything you need to escape the sandbox on your first try.",
    type: "article",
    url: "https://wraps.dev/blog/ses-sandbox-guide",
    images: [
      {
        url: "https://wraps.dev/blog/get-out-of-sandbox.png",
        width: 800,
        height: 421,
        alt: "How to Get Out of AWS SES Sandbox",
      },
    ],
    publishedTime: "2026-01-10T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Get Out of AWS SES Sandbox | Wraps",
    description:
      "The complete guide to SES production access approval. Checklists, templates, and everything you need.",
    images: ["https://wraps.dev/blog/get-out-of-sandbox.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/ses-sandbox-guide",
  },
};

export default function Page() {
  return <SESSandboxGuide />;
}
