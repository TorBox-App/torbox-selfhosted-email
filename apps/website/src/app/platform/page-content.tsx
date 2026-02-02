"use client";

import { useEffect } from "react";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { DashboardAutomationsSection } from "./components/automations-section";
import { DashboardBroadcastsSection } from "./components/broadcasts-section";
import { DashboardCtaSection } from "./components/cta-section";
import { DashboardEventsSection } from "./components/events-section";
import { DashboardFeaturesSection } from "./components/features-section";
import { DashboardHeroSection } from "./components/hero-section";
import { DashboardPricingSection } from "./components/pricing-section";
import { DashboardTemplatesSection } from "./components/templates-section";

export default function DashboardPageContent() {
  // Handle hash scrolling on page load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const timeoutId = setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          const targetPosition =
            element.getBoundingClientRect().top + window.scrollY;
          const startPosition = window.scrollY;
          const distance = targetPosition - startPosition;
          const duration = 1200; // ms - slower scroll
          let startTime: number | null = null;

          const easeInOutCubic = (t: number) =>
            t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

          const animateScroll = (currentTime: number) => {
            if (startTime === null) {
              startTime = currentTime;
            }
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = easeInOutCubic(progress);

            window.scrollTo(0, startPosition + distance * easeProgress);

            if (elapsed < duration) {
              requestAnimationFrame(animateScroll);
            }
          };

          requestAnimationFrame(animateScroll);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []);
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
        <DashboardEventsSection />
        <DashboardCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
