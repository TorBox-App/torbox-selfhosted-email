import { CliTabbedSection } from "./components/cli-tabbed-section";
import { CTASection } from "./components/cta-section";
import { ExistingSesSection } from "./components/existing-ses-section";
import { FaqSection } from "./components/faq-section";
import { LandingFooter } from "./components/footer";
import { HeroSection } from "./components/hero-section";
import { LandingNavbar } from "./components/navbar";
import { ProductTabbedSection } from "./components/product-tabbed-section";
import { SmsTeaserSection } from "./components/sms-teaser-section";
import { StatsSection } from "./components/stats-section";
import { TrustedBySection } from "./components/trusted-by-section";
import { premiumBgClass, UpgradeSection } from "./components/upgrade-section";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main>
        {/* Hero & Social Proof */}
        <HeroSection />
        <TrustedBySection />
        <StatsSection />

        {/* SMS Coming Soon Teaser */}
        <SmsTeaserSection />

        {/* Free Tier - CLI + SDK + Local Console (Tabbed) */}
        <CliTabbedSection />
        <ExistingSesSection />

        {/* Transition to Premium */}
        <UpgradeSection />

        {/* Premium Tier - Wraps Platform (Tabbed) */}
        <div className={premiumBgClass}>
          <ProductTabbedSection />
          <FaqSection />
          <CTASection />
        </div>
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
