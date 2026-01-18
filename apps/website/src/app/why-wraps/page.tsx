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
};

export default function WhyWrapsPage() {
  return <WhyWrapsPageContent />;
}
