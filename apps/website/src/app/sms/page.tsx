"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { SmsCtaSection } from "./components/cta-section";
import { SmsFeaturesSection } from "./components/features-section";
import { SmsHeroSection } from "./components/hero-section";
import { SmsPricingSection } from "./components/pricing-section";
import { SmsValuePropsSection } from "./components/value-props-section";

export default function SmsPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <SmsHeroSection />
        <SmsValuePropsSection />
        <SmsFeaturesSection />
        <SmsPricingSection />
        <SmsCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
