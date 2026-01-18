import type { Metadata } from "next";
import DMARCSucks from "./page-content";

export const metadata: Metadata = {
  title: "Your DMARC Policy is Useless",
  description:
    "82% of domains have no DMARC. Of those that do, most set p=none—which tells receivers not to enforce. An interactive deep-dive into email authentication.",
  openGraph: {
    title: "Your DMARC Policy is Useless | Wraps",
    description:
      "82% of domains have no DMARC. Of those that do, most set p=none—which tells receivers not to enforce. An interactive deep-dive into email authentication.",
    type: "article",
    url: "https://wraps.dev/blog/your-dmarc-policy-is-useless",
    images: [
      {
        url: "https://wraps.dev/blog/dmarc-policy-is-useless.png",
        width: 800,
        height: 421,
        alt: "Your DMARC policy is useless",
      },
    ],
    publishedTime: "2025-01-15T00:00:00.000Z",
    authors: ["Wraps Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your DMARC Policy is Useless | Wraps",
    description:
      "82% of domains have no DMARC. Of those that do, most set p=none. An interactive deep-dive into email authentication.",
    images: ["https://wraps.dev/blog/dmarc-policy-is-useless.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/blog/your-dmarc-policy-is-useless",
  },
};

export default function Page() {
  return <DMARCSucks />;
}
