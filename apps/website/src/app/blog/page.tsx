import type { Metadata } from "next";
import BlogContent from "./page-content";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Deep dives into email infrastructure, security, and developer experience. Interactive content that makes complex topics tangible.",
  openGraph: {
    title: "Blog | Wraps",
    description:
      "Deep dives into email infrastructure, security, and developer experience. Interactive content that makes complex topics tangible.",
    type: "website",
    url: "https://wraps.dev/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Wraps",
    description:
      "Deep dives into email infrastructure, security, and developer experience.",
  },
};

export default function BlogPage() {
  return <BlogContent />;
}
