"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { SdkAutomationsSection } from "./components/automations-section";
import { SdkCtaSection } from "./components/cta-section";
import { SdkEventsSection } from "./components/events-section";
import { SdkFeaturesSection } from "./components/features-section";
import { SdkHeroSection } from "./components/hero-section";
import { SdkInstallSection } from "./components/install-section";
import { SdkTemplatesSection } from "./components/templates-section";

export default function SdkPageContent() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <SdkHeroSection />
        <SdkInstallSection />
        <SdkTemplatesSection />
        <SdkAutomationsSection />
        <SdkEventsSection />
        <SdkFeaturesSection />
        <SdkCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
