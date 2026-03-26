"use client";

import { useEffect } from "react";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { DashboardAutomationsSection } from "./components/automations-section";
import { DashboardBroadcastsSection } from "./components/broadcasts-section";
import { DashboardCtaSection } from "./components/cta-section";
import { DashboardFeaturesSection } from "./components/features-section";
import { DashboardHeroSection } from "./components/hero-section";
import { HowItWorksSection } from "./components/how-it-works-section";
import { SlantTransition } from "./components/slant-transition";
import { DashboardTemplatesSection } from "./components/templates-section";

export default function DashboardPageContent() {
  // Handle hash scrolling after page layout settles
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.querySelector(hash);
      if (!element) return;

      // Jump to approximate position immediately to avoid blank viewport
      element.scrollIntoView({ behavior: "instant" as ScrollBehavior });

      // Once images above the anchor load and layout is stable, smooth-scroll
      // to the final position (it may have shifted)
      const timeoutId = setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth" });
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <DashboardHeroSection />
        <HowItWorksSection />
        <DashboardTemplatesSection />
        <DashboardBroadcastsSection />
        <SlantTransition />
        <DashboardAutomationsSection />
        <DashboardFeaturesSection />
        <DashboardCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
