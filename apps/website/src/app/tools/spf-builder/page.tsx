import type { Metadata } from "next";
import SPFBuilderPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SPF Record Builder",
  description:
    "Build and validate your SPF record. Avoid the 10-lookup limit with our interactive tool.",
  openGraph: {
    title: "SPF Record Builder | Wraps",
    description:
      "Build and validate your SPF record. Avoid the 10-lookup limit with our interactive tool.",
  },
  twitter: {
    title: "SPF Record Builder | Wraps",
    description:
      "Build and validate your SPF record. Avoid the 10-lookup limit with our interactive tool.",
  },
};

export default function SPFBuilderPage() {
  return <SPFBuilderPageContent />;
}
