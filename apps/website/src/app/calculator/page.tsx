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
  alternates: {
    canonical: "https://wraps.dev/calculator",
  },
};

export default function CostCalculatorPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Email Cost Calculator</h1>
        <p>
          Compare email provider pricing. See exactly how much you'll save with
          AWS SES vs Resend, Postmark, and more.
        </p>
        <h2>AWS SES Pricing</h2>
        <h2>Resend Pricing</h2>
        <h2>Postmark Pricing</h2>
        <h2>Mailgun Pricing</h2>
        <h2>SendGrid Pricing</h2>
      </article>
      <CostCalculatorPageContent />
    </>
  );
}
