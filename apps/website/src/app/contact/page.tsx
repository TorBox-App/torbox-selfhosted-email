import type { Metadata } from "next";
import { ContactSection } from "@/app/landing/components/contact-section";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";

export const metadata: Metadata = {
  title: "Contact Us - Get Help with Wraps",
  description:
    "Need help or have questions about Wraps? Reach out via our contact form, Discord community, or GitHub. We're here to help.",
  openGraph: {
    title: "Contact Us | Wraps",
    description:
      "Need help or have questions about Wraps? Reach out via our contact form, Discord community, or GitHub.",
    type: "website",
    url: "https://wraps.dev/contact",
  },
  twitter: {
    title: "Contact Us | Wraps",
    description:
      "Need help or have questions about Wraps? Reach out via our contact form, Discord community, or GitHub.",
  },
  alternates: {
    canonical: "https://wraps.dev/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
