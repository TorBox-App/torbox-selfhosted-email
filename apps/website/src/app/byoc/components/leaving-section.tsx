import { SectionKicker } from "@/app/landing/components/section-kicker";

export function LeavingSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionKicker>Leaving</SectionKicker>
        <h2 className="mb-6 font-heading font-semibold text-2xl tracking-tight sm:text-3xl">
          Stop paying Wraps. Your sending infrastructure keeps running.
        </h2>
        <p className="mb-4 text-muted-foreground">
          Your SES setup, domain reputation, IAM roles, and the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-sm">
            wraps-email-history
          </code>{" "}
          DynamoDB table stay in your AWS account. Your SDK code keeps sending.
          None of that requires an active Wraps subscription.
        </p>
        <p className="text-muted-foreground">
          Contacts, templates, and workflows live on the Wraps platform. Export
          them before you go.
        </p>
      </div>
    </section>
  );
}
