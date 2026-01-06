"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { DashboardAutomationsSection } from "./components/automations-section";
import { DashboardBroadcastsSection } from "./components/broadcasts-section";
import { DashboardCtaSection } from "./components/cta-section";
import { DashboardFeaturesSection } from "./components/features-section";
import { DashboardHeroSection } from "./components/hero-section";
import { DashboardPricingSection } from "./components/pricing-section";
import { DashboardTemplatesSection } from "./components/templates-section";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <DashboardHeroSection />
        <DashboardTemplatesSection />
        <DashboardBroadcastsSection />
        <DashboardAutomationsSection />
        <DashboardFeaturesSection />
        <DashboardPricingSection />
        <DashboardCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
