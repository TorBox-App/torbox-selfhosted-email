import { SectionKicker } from "@/app/landing/components/section-kicker";

export function WhatByocMeansSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionKicker>What BYOC means here</SectionKicker>
        <h2 className="mb-6 font-heading font-semibold text-2xl tracking-tight sm:text-3xl">
          A control plane you don&apos;t manage. A data plane you own.
        </h2>
        <p className="mb-4 text-muted-foreground">
          BYOC, bring your own cloud, splits a system into two parts. The vendor
          hosts and operates the control plane: the UI, the orchestration logic,
          the state that makes the product usable. The data plane, the part that
          actually touches your traffic and your data, runs in your own cloud
          account.
        </p>
        <p className="text-muted-foreground">
          Wraps is BYOC for sending, not for everything. Your dashboard,
          templates, workflows, and contacts are hosted by Wraps. Your email
          sends through your own AWS SES, and your delivery events land in your
          own DynamoDB. Sending infrastructure you own, orchestrated by a
          platform you don&apos;t have to run.
        </p>
      </div>
    </section>
  );
}
