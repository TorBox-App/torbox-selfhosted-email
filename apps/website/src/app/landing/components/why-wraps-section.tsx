import Image from "next/image";

export function WhyWrapsSection() {
  return (
    <section className="border-y bg-muted/30 py-24" id="why-wraps">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[240px_1fr] md:gap-16 lg:gap-24">
          {/* Founder photo + name */}
          <div className="flex flex-col items-start animate-fade-in-up">
            <Image
              alt="Jarod, founder of Wraps"
              className="rounded-xl"
              height={200}
              src="/team/jarod-medium-smile.webp"
              width={200}
            />
            <p className="mt-4 font-semibold text-foreground">Jarod</p>
            <p className="text-sm text-muted-foreground">Founder, Wraps</p>
          </div>

          {/* Narrative */}
          <div className="flex flex-col gap-6 animate-fade-in-up animation-delay-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">
              Why Wraps
            </p>

            <p className="text-lg leading-relaxed text-muted-foreground">
              I spent years at SendGrid watching companies pay hundreds a month
              to send emails through infrastructure they didn&rsquo;t own. When
              vendors change pricing, get acquired, or suspend your
              account&mdash;you&rsquo;re stuck. But traditional tools
              weren&rsquo;t built for ownership.
            </p>

            <p className="text-lg leading-relaxed text-muted-foreground">
              Postmark charges per email. Resend charges per email. SendGrid
              charges per contact. None of them deploy to your AWS account.
              You&rsquo;re always renting.
            </p>

            <p className="text-lg font-semibold leading-relaxed text-foreground">
              So I built Wraps. Deploy to your AWS and use the platform when you
              need to send broadcasts, manage templates with a team, or create
              automations.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
