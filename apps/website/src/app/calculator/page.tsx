import type { Metadata } from "next";
import { Suspense } from "react";
import CostCalculatorPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email Cost Calculator",
  description:
    "Compare email provider pricing. See exactly how much you'll save with AWS SES vs Resend, Postmark, and more.",
  openGraph: {
    title: "Email Cost Calculator | Wraps",
    description:
      "Compare email provider pricing. See exactly how much you'll save with AWS SES vs Resend, Postmark, and more.",
  },
  twitter: {
    title: "Email Cost Calculator | Wraps",
    description:
      "Compare email provider pricing. See exactly how much you'll save with AWS SES vs Resend, Postmark, and more.",
  },
  alternates: {
    canonical: "https://wraps.dev/calculator",
  },
};

export default function CostCalculatorPage() {
  return (
    <Suspense>
      <CostCalculatorPageContent />
    </Suspense>
  );
}
