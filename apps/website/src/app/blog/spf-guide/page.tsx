import type { Metadata } from "next";
import SPFGuidePage from "./page-content";

export const metadata: Metadata = {
  title: "The SPF 10-Lookup Limit: Why Your Email Might Be Failing",
  description:
    "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted, which providers cost the most, and how to stay under the limit.",
  openGraph: {
    title: "The SPF 10-Lookup Limit | Wraps",
    description:
      "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted, which providers cost the most, and how to stay under the limit.",
    type: "article",
    url: "https://wraps.dev/blog/spf-guide",
    images: [
      {
        url: "https://wraps.dev/og-image.png",
        width: 1200,
        height: 630,
        alt: "SPF 10-Lookup Limit Guide",
      },
    ],
    publishedTime: "2026-01-12T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The SPF 10-Lookup Limit | Wraps",
    description:
      "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted and how to stay under.",
    images: ["https://wraps.dev/og-image.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/spf-guide",
  },
};

export default function Page() {
  return <SPFGuidePage />;
}
