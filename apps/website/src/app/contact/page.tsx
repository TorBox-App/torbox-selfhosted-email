import type { Metadata } from "next";
import { ContactSection } from "@/app/landing/components/contact-section";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";

export const metadata: Metadata = {
  title: "Contact Us - Book a Call with Wraps",
  description:
    "Schedule a call with the Wraps team to discuss your email infrastructure needs. Or reach out via Discord or GitHub.",
  openGraph: {
    title: "Contact Us | Wraps",
    description:
      "Schedule a call with the Wraps team to discuss your email infrastructure needs.",
    type: "website",
    url: "https://wraps.dev/contact",
  },
  twitter: {
    title: "Contact Us | Wraps",
    description:
      "Schedule a call with the Wraps team to discuss your email infrastructure needs.",
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
