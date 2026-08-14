import { ControlPlaneDataPlaneTable } from "@/app/landing/components/control-plane-data-plane-table";
import { SectionKicker } from "@/app/landing/components/section-kicker";

export function LivesWhereSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionKicker>What lives where</SectionKicker>
        <h2 className="mb-8 font-heading font-semibold text-2xl tracking-tight sm:text-3xl">
          Wraps orchestrates. Your AWS sends and stores.
        </h2>
        <ControlPlaneDataPlaneTable />
      </div>
    </section>
  );
}
