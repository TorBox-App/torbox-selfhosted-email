import type { Metadata } from "next";
import WhyWrapsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Why Wraps",
  description:
    "Own your infrastructure, pay AWS prices, keep the great DX. No vendor lock-in, full data control.",
  openGraph: {
    title: "Why Wraps | Wraps",
    description:
      "Own your infrastructure, pay AWS prices, keep the great DX. No vendor lock-in, full data control.",
  },
  twitter: {
    title: "Why Wraps | Wraps",
    description:
      "Own your infrastructure, pay AWS prices, keep the great DX. No vendor lock-in, full data control.",
  },
  alternates: {
    canonical: "https://wraps.dev/why-wraps",
  },
};

export default function WhyWrapsPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Why Wraps</h1>
        <p>
          Own your infrastructure, pay AWS prices, keep the great DX. No vendor
          lock-in, full data control.
        </p>
        <h2>Infrastructure Ownership</h2>
        <h2>AWS Pricing</h2>
        <h2>Developer Experience</h2>
        <h2>No Vendor Lock-in</h2>
      </article>
      <WhyWrapsPageContent />
    </>
  );
}
