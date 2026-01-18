import type { Metadata } from "next";
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
};

export default function CostCalculatorPage() {
  return <CostCalculatorPageContent />;
}
