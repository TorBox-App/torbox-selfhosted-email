import { ProductTabs } from "./product-tabs";

export function ProductTabbedSection() {
  return (
    <section className="py-24" id="platform">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header - server rendered */}
        <div className="mx-auto mb-12 max-w-5xl text-center animate-fade-in-up">
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              Automate.
            </span>{" "}
            Broadcast. Design.
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Build workflows that trigger on user behavior. Send broadcasts to
            segments. Design templates with AI. All while sending through your
            AWS at $0.10/1K
          </p>
        </div>

        {/* Interactive tabs - client component (no max-width constraint for full-width images) */}
        <div className="animate-fade-in-up animation-delay-100">
          <ProductTabs />
        </div>
      </div>
    </section>
  );
}
