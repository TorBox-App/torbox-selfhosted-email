import { CliTabbedSection } from "./landing/components/cli-tabbed-section";
import { CTASection } from "./landing/components/cta-section";
import { FaqSection } from "./landing/components/faq-section";
import { LandingFooter } from "./landing/components/footer";
import { HeroSection } from "./landing/components/hero-section";
import { LandingNavbar } from "./landing/components/navbar";
import { PricingSection } from "./landing/components/pricing-section";
import { PrinciplesSection } from "./landing/components/principles-section";
import { ProductTabbedSection } from "./landing/components/product-tabbed-section";
import { TrustedBySection } from "./landing/components/trusted-by-section";
import { WorkflowBuilderSection } from "./landing/components/workflow-builder-section";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main>
        {/* Hero & Credibility */}
        <HeroSection />
        <TrustedBySection />
        <PrinciplesSection />

        {/* Primary: Wraps Platform */}
        <ProductTabbedSection />

        {/* Interactive Workflow Builder */}
        <WorkflowBuilderSection />

        {/* Pricing */}
        <PricingSection />

        {/* Free Tier - CLI + SDK */}
        <CliTabbedSection />

        {/* Footer sections */}
        <FaqSection />
        <CTASection />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
